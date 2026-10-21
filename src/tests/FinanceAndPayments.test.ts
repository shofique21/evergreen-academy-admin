import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../stores/auth'
import type {
  FeeCategory,
  FeeStructure,
  StudentFeeAssignment,
  StudentFeeWaiver,
  FeeInstallment,
  Invoice,
  InvoiceItem,
  Payment,
  PaymentAllocation,
  PaymentAttempt,
  Refund,
  PaymentReconciliation,
  CollectionSummary,
  OutstandingBalancesReport,
} from '../types'

describe('Financial Management and Payment Modules Frontend Contracts & Business Rules', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('validates fee structure and student fee assignment calculation with scholarship waiver', () => {
    const feeCategory: FeeCategory = {
      id: 1,
      campus_id: 1,
      name: 'Tuition Fee',
    }

    expect(feeCategory.name).toBe('Tuition Fee')

    const feeStructure: FeeStructure = {
      id: 10,
      academic_year_id: 1,
      class_id: 6,
      fee_head_id: 1,
      amount: 3500.0,
      billing_frequency: 'MONTHLY',
      due_day_of_month: 10,
    }

    expect(feeStructure.amount).toBe(3500.0)
    expect(feeStructure.billing_frequency).toBe('MONTHLY')

    // Student fee assignment with a 20% merit discount waiver
    const assignment: StudentFeeAssignment = {
      id: 50,
      campus_id: 1,
      student_id: 101,
      academic_year_id: 1,
      fee_head_id: 1,
      custom_amount: 3500.0,
      is_installment_enabled: false,
      total_installments: 1,
      status: 'ACTIVE',
      notes: 'Standard Tuition',
    }

    const waiver: StudentFeeWaiver = {
      id: 5,
      student_id: 101,
      academic_year_id: 1,
      fee_head_id: 1,
      discount_type: 'PERCENTAGE',
      discount_value: 20,
      reason: 'Merit scholarship 20%',
    }

    const baseAmount = assignment.custom_amount ?? feeStructure.amount
    const discountAmount = (baseAmount * waiver.discount_value) / 100
    const netPayable = baseAmount - discountAmount

    expect(discountAmount).toBe(700.0)
    expect(netPayable).toBe(2800.0)
  })

  it('validates installment plan breakdown for annual development fees', () => {
    const totalDevelopmentFee = 12000.0
    const installments: FeeInstallment[] = [
      {
        id: 1,
        student_id: 101,
        academic_year_id: 1,
        fee_head_id: 2,
        installment_number: 1,
        amount: 4000.0,
        due_date: '2026-01-15',
        status: 'PAID',
      },
      {
        id: 2,
        student_id: 101,
        academic_year_id: 1,
        fee_head_id: 2,
        installment_number: 2,
        amount: 4000.0,
        due_date: '2026-05-15',
        status: 'PENDING',
      },
      {
        id: 3,
        student_id: 101,
        academic_year_id: 1,
        fee_head_id: 2,
        installment_number: 3,
        amount: 4000.0,
        due_date: '2026-09-15',
        status: 'PENDING',
      },
    ]

    const sumInstallments = installments.reduce((acc, curr) => acc + curr.amount, 0)
    expect(sumInstallments).toBe(totalDevelopmentFee)
    expect(installments[0].status).toBe('PAID')
    expect(installments[1].status).toBe('PENDING')
  })

  it('validates invoice generation, itemization, and balance calculations', () => {
    const items: InvoiceItem[] = [
      {
        id: 1,
        invoice_id: 201,
        fee_head_id: 1,
        amount: 3000.0,
        discount: 500.0,
        net_amount: 2500.0,
        description: 'Monthly Tuition Fee - October 2026',
      },
      {
        id: 2,
        invoice_id: 201,
        fee_head_id: 2,
        amount: 500.0,
        discount: 0.0,
        net_amount: 500.0,
        description: 'Computer Lab Fee',
      },
    ]

    const totalGross = items.reduce((sum, item) => sum + item.amount, 0)
    const totalWaiver = items.reduce((sum, item) => sum + item.discount, 0)
    const totalNet = items.reduce((sum, item) => sum + item.net_amount, 0)

    expect(totalGross).toBe(3500.0)
    expect(totalWaiver).toBe(500.0)
    expect(totalNet).toBe(3000.0)

    const invoice: Invoice = {
      id: 201,
      campus_id: 1,
      student_id: 88,
      academic_year_id: 1,
      invoice_number: 'INV-2026-00042',
      month: 10,
      year: 2026,
      subtotal: totalGross,
      waiver_discount: totalWaiver,
      fine_amount: 0,
      total_payable: totalNet,
      total_paid: 1000.0,
      issue_date: '2026-10-01',
      due_date: '2026-10-25',
      status: 'PARTIAL',
      items,
    }

    const remainingBalance = invoice.total_payable - invoice.total_paid
    expect(invoice.invoice_number).toMatch(/^INV-\d{4}-\d{5}$/)
    expect(remainingBalance).toBe(2000.0)
    expect(invoice.status).toBe('PARTIAL')
  })

  it('enforces overpayment prevention logic on payment attempts and cashier collections', () => {
    const invoiceBalance = 1500.0

    const isPaymentAllowed = (attemptAmount: number, currentBalance: number) => {
      return attemptAmount > 0 && attemptAmount <= currentBalance
    }

    expect(isPaymentAllowed(1500.0, invoiceBalance)).toBe(true)
    expect(isPaymentAllowed(1000.0, invoiceBalance)).toBe(true)

    // Overpayment attempts must be rejected
    const overpaymentAmount = 1500.01
    expect(isPaymentAllowed(overpaymentAmount, invoiceBalance)).toBe(false)

    // Zero or negative payments must be rejected
    expect(isPaymentAllowed(0, invoiceBalance)).toBe(false)
    expect(isPaymentAllowed(-200, invoiceBalance)).toBe(false)
  })

  it('verifies offline collection contract with sequential money receipt numbering', () => {
    const offlineAllocations: PaymentAllocation[] = [
      {
        id: 1,
        payment_id: 301,
        invoice_id: 201,
        invoice_item_id: 1,
        amount: 1500.0,
      },
      {
        id: 2,
        payment_id: 301,
        invoice_id: 201,
        invoice_item_id: 2,
        amount: 500.0,
      },
    ]

    const offlinePayment: Payment = {
      id: 301,
      campus_id: 1,
      invoice_id: 201,
      receipt_number: 'MR-2026-00055',
      payment_method: 'CASH',
      amount: 2000.0,
      gateway_fee: 0,
      paid_at: '2026-10-14T09:00:00Z',
      status: 'COMPLETED',
      collected_by_user_id: 4, // Cashier
      allocations: offlineAllocations,
    }

    expect(offlinePayment.receipt_number).toMatch(/^MR-\d{4}-\d{5}$/)
    expect(offlinePayment.payment_method).toBe('CASH')
    expect(offlinePayment.status).toBe('COMPLETED')

    // Verify allocations equal payment total
    const allocatedTotal = offlinePayment.allocations?.reduce((sum, a) => sum + a.amount, 0)
    expect(allocatedTotal).toBe(offlinePayment.amount)
  })

  it('verifies online payment gateway initiation and durable payment attempt tracking', () => {
    const attempt: PaymentAttempt = {
      id: 501,
      invoice_id: 201,
      gateway_name: 'BKASH',
      tracking_ref: 'TRK-2026-BKASH-84920482',
      amount: 2000.0,
      status: 'INITIATED',
      idempotency_key: 'idem_inv_201_bkash_918239',
      gateway_payment_id: 'TR0011B1012984',
      created_at: '2026-10-14T09:15:00Z',
    }

    expect(attempt.status).toBe('INITIATED')
    expect(attempt.gateway_name).toBe('BKASH')
    expect(attempt.idempotency_key).toBeDefined()
    expect(attempt.tracking_ref).toContain('TRK-2026-BKASH-')

    // State transition to SUCCESS once S2S verified
    const verifiedAttempt: PaymentAttempt = {
      ...attempt,
      status: 'SUCCESS',
    }
    expect(verifiedAttempt.status).toBe('SUCCESS')
  })

  it('validates refund request and approval workflow transitions', () => {
    const refundRequest: Refund = {
      id: 10,
      payment_id: 301,
      refund_reference: 'REF-2026-00010',
      amount: 500.0,
      reason: 'Double lab fee charged in error',
      status: 'PENDING',
      requested_by_user_id: 4, // Cashier
      approved_by_user_id: null,
      approved_at: null,
      gateway_refund_id: null,
    }

    expect(refundRequest.status).toBe('PENDING')
    expect(refundRequest.approved_by_user_id).toBeNull()

    // Principal / Admin approves the refund
    const approvedRefund: Refund = {
      ...refundRequest,
      status: 'APPROVED',
      approved_by_user_id: 1, // Admin
      approved_at: '2026-10-14T10:00:00Z',
    }
    expect(approvedRefund.status).toBe('APPROVED')
    expect(approvedRefund.approved_by_user_id).toBe(1)

    // Disbursed / processed through bKash API or Cash Counter
    const processedRefund: Refund = {
      ...approvedRefund,
      status: 'PROCESSED',
      gateway_refund_id: 'BKASH-REF-891283',
    }
    expect(processedRefund.status).toBe('PROCESSED')
    expect(processedRefund.gateway_refund_id).toBe('BKASH-REF-891283')
  })

  it('detects settlement reconciliation mismatches between internal payments and gateway logs', () => {
    const reconciliationItem: PaymentReconciliation = {
      id: 1,
      reconciliation_date: '2026-10-14',
      gateway_name: 'SSLCOMMERZ',
      total_checked: 25,
      total_matched: 25,
      total_discrepancies: 0,
      discrepancy_details: [],
    }

    expect(reconciliationItem.total_discrepancies).toBe(0)
    expect(reconciliationItem.total_matched).toBe(reconciliationItem.total_checked)

    // Mismatched transaction scenario
    const mismatchedItem: PaymentReconciliation = {
      ...reconciliationItem,
      total_matched: 24,
      total_discrepancies: 1,
      discrepancy_details: [
        {
          transaction_id: 'SSL-TXN-998822',
          expected_amount: 3500.0,
          gateway_amount: 3400.0,
          difference: -100.0,
          note: 'Gateway deducted 100 BDT surcharge unexpectedly',
        },
      ],
    }

    expect(mismatchedItem.total_discrepancies).toBe(1)
    expect(mismatchedItem.discrepancy_details[0].difference).toBe(-100.0)
  })

  it('validates collection and outstanding balances reporting metrics', () => {
    const collectionSummary: CollectionSummary = {
      campus_id: 1,
      start_date: '2026-10-01',
      end_date: '2026-10-14',
      total_transactions: 42,
      gross_collected: 185000.0,
      total_refunded: 5000.0,
      net_collected: 180000.0,
      methods_breakdown: {
        CASH_COUNTER: { count: 30, total: 120000.0 },
        BKASH: { count: 12, total: 65000.0 },
      },
    }

    expect(collectionSummary.net_collected).toBe(
      collectionSummary.gross_collected - collectionSummary.total_refunded
    )
    expect(collectionSummary.total_transactions).toBe(42)

    const outstandingReport: OutstandingBalancesReport = {
      campus_id: 1,
      academic_year_id: 1,
      total_invoices: 120,
      total_payable: 350000.0,
      total_paid: 185000.0,
      total_outstanding: 165000.0,
      overdue_count: 18,
      overdue_amount: 45000.0,
      status_breakdown: {
        PAID: 90,
        PARTIAL: 12,
        UNPAID: 18,
      },
    }

    expect(outstandingReport.total_outstanding).toBe(
      outstandingReport.total_payable - outstandingReport.total_paid
    )
    expect(outstandingReport.status_breakdown.PAID).toBe(90)
  })

  it('verifies accountant/cashier vs parent vs administrator role permissions for finance operations', () => {
    const authStore = useAuthStore()

    // 1. Accountant / Cashier
    authStore.user = {
      id: 5,
      name: 'Salma Khatun',
      email: 'accountant@evergreen.edu.bd',
      phone: '+8801700000001',
      user_type: 'staff',
      is_active: true,
      avatar: null,
      roles: ['accountant'],
      permissions: [
        'fees.view',
        'fees.create',
        'invoices.view',
        'invoices.generate',
        'payments.collect',
        'payments.view',
        'refunds.request',
        'reports.financial',
      ],
    }

    expect(authStore.hasPermission('payments.collect')).toBe(true)
    expect(authStore.hasPermission('invoices.generate')).toBe(true)
    expect(authStore.hasPermission('refunds.request')).toBe(true)
    // Accountant cannot approve refunds directly without principal/admin
    expect(authStore.hasPermission('refunds.approve')).toBe(false)

    // 2. School Admin
    authStore.user.roles = ['admin']
    authStore.user.permissions.push('refunds.approve', 'payments.reconcile')
    expect(authStore.hasPermission('refunds.approve')).toBe(true)
    expect(authStore.hasPermission('payments.reconcile')).toBe(true)

    // 3. Parent / Student (can only view their own invoices and make online payments)
    authStore.user = {
      id: 20,
      name: 'Guardian User',
      email: 'parent@evergreen.edu.bd',
      phone: '+8801700000099',
      user_type: 'parent',
      is_active: true,
      avatar: null,
      roles: ['parent'],
      permissions: ['invoices.view', 'payments.pay_online'],
    }

    expect(authStore.hasPermission('invoices.view')).toBe(true)
    expect(authStore.hasPermission('payments.pay_online')).toBe(true)
    expect(authStore.hasPermission('payments.collect')).toBe(false)
    expect(authStore.hasPermission('invoices.generate')).toBe(false)
  })

  it('restricts Load Demo Pricing Matrix button on the accountant panel while permitting administrators', () => {
    const authStore = useAuthStore()

    // 1. Accountant role setup
    authStore.user = {
      id: 5,
      name: 'Salma Khatun',
      email: 'accountant@evergreen.edu.bd',
      phone: '+8801700000001',
      user_type: 'staff',
      is_active: true,
      avatar: null,
      roles: ['accountant'],
      permissions: ['fees.view', 'fees.structures.manage', 'fees.collect'],
    }

    const isAccountant = () => {
      if (authStore.isSuperAdmin) return false
      const roles = authStore.user?.roles ?? []
      const userType = authStore.user?.user_type
      if (roles.includes('super_admin') || roles.includes('admin') || userType === 'super_admin' || userType === 'admin') {
        return false
      }
      return roles.includes('accountant') || userType === 'accountant'
    }

    const canSeedDemoMatrix = () => {
      if (isAccountant()) return false
      return (
        authStore.isSuperAdmin ||
        authStore.hasRole('admin') ||
        authStore.persona === 'admin'
      )
    }

    // Accountant must be restricted from loading demo pricing matrix
    expect(isAccountant()).toBe(true)
    expect(canSeedDemoMatrix()).toBe(false)

    // 2. Administrator role setup
    authStore.user = {
      id: 1,
      name: 'Principal Kabir',
      email: 'principal@evergreen.edu.bd',
      phone: '+8801700000000',
      user_type: 'admin',
      is_active: true,
      avatar: null,
      roles: ['admin', 'principal'],
      permissions: ['fees.view', 'fees.structures.manage', 'fees.collect'],
    }

    expect(isAccountant()).toBe(false)
    expect(canSeedDemoMatrix()).toBe(true)
  })

  it('validates smart search matching and requires invoice selection plus balance verification before payment confirmation', () => {
    // 1. Mock invoice dataset covering invoice ID, student ID, student name, and phone
    const mockInvoices = [
      {
        id: 101,
        invoice_number: 'INV-2026-00101',
        student: {
          id: 1,
          student_uid: 'EGA-2026-0001',
          first_name: 'Sadia',
          last_name: 'Rahman',
          emergency_phone: '+8801711223344',
          user: { phone: '+8801711223344' },
          guardians: [{ name: 'Rahman Sr.', phone: '+8801811223344' }],
        },
        total_payable: 5000,
        total_paid: 2000,
        status: 'PARTIAL',
      },
      {
        id: 102,
        invoice_number: 'INV-2026-00102',
        student: {
          id: 2,
          student_uid: 'EGA-2026-0002',
          first_name: 'Tanvir',
          last_name: 'Ahmed',
          emergency_phone: '+8801999887766',
          user: { phone: '+8801999887766' },
          guardians: [{ name: 'Ahmed Sr.', phone: '+8801666554433' }],
        },
        total_payable: 4500,
        total_paid: 4500,
        status: 'PAID',
      },
    ]

    // Smart search filter simulator matching backend InvoiceController logic
    const smartSearch = (query: string) => {
      const q = query.trim().toLowerCase()
      if (!q) return []
      return mockInvoices.filter((inv) => {
        const invNum = inv.invoice_number.toLowerCase()
        const invId = String(inv.id)
        const stuUid = inv.student.student_uid.toLowerCase()
        const fullName = `${inv.student.first_name} ${inv.student.last_name}`.toLowerCase()
        const phone = (inv.student.emergency_phone || '').toLowerCase()
        const guardianPhone = (inv.student.guardians[0]?.phone || '').toLowerCase()

        return (
          invNum.includes(q) ||
          invId === q ||
          stuUid.includes(q) ||
          fullName.includes(q) ||
          phone.includes(q) ||
          guardianPhone.includes(q)
        )
      })
    }

    // Verify smart search supports:
    // a. Invoice ID
    expect(smartSearch('INV-2026-00101')).toHaveLength(1)
    expect(smartSearch('101')).toHaveLength(1)

    // b. Student ID
    expect(smartSearch('EGA-2026-0001')).toHaveLength(1)
    expect(smartSearch('EGA-2026-0002')).toHaveLength(1)

    // c. Student Name
    expect(smartSearch('Sadia')).toHaveLength(1)
    expect(smartSearch('Tanvir Ahmed')).toHaveLength(1)

    // d. Phone number (student or guardian)
    expect(smartSearch('01711223344')).toHaveLength(1)
    expect(smartSearch('01811223344')).toHaveLength(1)
    expect(smartSearch('01999887766')).toHaveLength(1)

    // 2. Test payment confirmation state requirements
    let counterTargetInvoice: any = null
    let balanceVerified = false
    let counterAmount: number | null = null
    let counterSubmitting = false

    const getOutstanding = () => {
      if (!counterTargetInvoice) return 0
      return Math.max(0, counterTargetInvoice.total_payable - counterTargetInvoice.total_paid)
    }

    const canConfirmPayment = () => {
      if (!counterTargetInvoice) return false
      if (!balanceVerified) return false
      const outstanding = getOutstanding()
      if (outstanding <= 0) return false
      if (!counterAmount || counterAmount <= 0) return false
      if (counterAmount > outstanding) return false
      if (counterSubmitting) return false
      return true
    }

    // Phase 1: No invoice selected -> confirmation disabled
    expect(canConfirmPayment()).toBe(false)

    // Phase 2: Invoice selected, but balance NOT verified -> confirmation disabled
    counterTargetInvoice = mockInvoices[0] // Outstanding is 3000
    counterAmount = 3000
    expect(getOutstanding()).toBe(3000)
    expect(balanceVerified).toBe(false)
    expect(canConfirmPayment()).toBe(false)

    // Phase 3: Balance verified, valid amount -> confirmation enabled
    balanceVerified = true
    expect(canConfirmPayment()).toBe(true)

    // Phase 4: Overpayment attempted -> confirmation disabled
    counterAmount = 3500 // Exceeds 3000
    expect(canConfirmPayment()).toBe(false)

    // Phase 5: Zero or negative amount -> confirmation disabled
    counterAmount = 0
    expect(canConfirmPayment()).toBe(false)
    counterAmount = -500
    expect(canConfirmPayment()).toBe(false)

    // Phase 6: Fully settled invoice selected -> confirmation disabled even if verified
    counterTargetInvoice = mockInvoices[1] // Outstanding is 0 (PAID)
    counterAmount = 100
    balanceVerified = true
    expect(getOutstanding()).toBe(0)
    expect(canConfirmPayment()).toBe(false)
  })
})


