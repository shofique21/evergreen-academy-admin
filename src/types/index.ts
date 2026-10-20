export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'principal'
  | 'admissions_officer'
  | 'exam_controller'
  | 'accountant'
  | 'teacher'
  | 'librarian'
  | 'staff'
  | 'student'
  | 'parent'

export interface Campus {
  id: number
  code: string
  name: string
  eiin?: string | null
  address?: string
  phone?: string | null
  email?: string | null
  is_active: boolean
}

export interface User {
  id: number
  campus_id?: number | null
  campus?: Campus | null
  name: string
  email: string
  phone: string | null
  user_type: string
  is_active: boolean
  avatar: string | null
  roles: string[]
  permissions: string[]
  created_at?: string
}

export interface LoginPayload {
  email: string
  password: string
  remember?: boolean
}

export interface AuthResponse {
  message: string
  user: User
  token?: string
}

export interface PaginationMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
  has_more?: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data: T
  meta?: {
    timestamp?: string
    correlation_id?: string | null
    pagination?: PaginationMeta
    current_page?: number
    total?: number
    per_page?: number
    last_page?: number
  }
}

export interface SystemHealth {
  status: string
  app_name: string
  timestamp: string
  php_version: string
  laravel_version: string
  database: string
  cache_redis: string
}

export interface NavMenuItem {
  label: string
  icon?: string
  to?: string
  permission?: string
  roles?: string[]
  badge?: string
  badgeSeverity?: string
  items?: NavMenuItem[]
}

export interface BreadcrumbItem {
  label: string
  to?: string
  icon?: string
}

export interface AcademicTerm {
  id: number
  academic_year_id: number
  name: string
  term_code: string
  start_date: string
  end_date: string
  is_active: boolean
}

export interface AcademicYear {
  id: number
  campus_id: number
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  status: string
  terms?: AcademicTerm[]
}

export interface Classroom {
  id: number
  campus_id: number
  room_number: string
  building_name: string
  capacity: number
  room_type: string
}

export interface Shift {
  id: number
  campus_id: number
  name: string
  start_time: string
  end_time: string
  is_active: boolean
}

export interface Medium {
  id: number
  campus_id: number
  name: string
  code: string
  is_active: boolean
}

export interface Section {
  id: number
  class_id: number
  shift_id: number
  medium_id: number
  name: string
  capacity: number
  room_number?: string | null
  is_active: boolean
  shift?: Shift
  medium?: Medium
}

export interface Subject {
  id: number
  class_id: number
  name: string
  code: string
  type: string
  full_marks: number
  pass_marks: number
  has_practical: boolean
  is_active: boolean
}

export interface ClassLevel {
  id: number
  campus_id: number
  name: string
  numeric_level: number
  is_active: boolean
  sections?: Section[]
  subjects?: Subject[]
}

export interface AcademicStructure {
  campuses: Campus[]
  current_session: AcademicYear | null
  academic_years: AcademicYear[]
  shifts: Shift[]
  mediums: Medium[]
  classes: ClassLevel[]
}

// Student & SIS Domain Types
export interface Guardian {
  id: number
  name: string
  phone: string
  email?: string | null
  occupation?: string | null
  nid_number?: string | null
  address?: string | null
  relationship?: string
}

export interface StudentEnrollment {
  id: number
  student_id: number
  academic_year_id: number
  class_id: number
  section_id: number
  roll_number: number
  status: string
  opening_balance_arrears: number
  class_level?: ClassLevel
  classLevel?: ClassLevel
  section?: Section
  academic_year?: AcademicYear
  academicYear?: AcademicYear
}

export interface Student {
  id: number
  campus_id: number
  student_uid: string
  first_name: string
  last_name: string
  full_name?: string
  date_of_birth: string
  gender: string
  blood_group?: string | null
  religion?: string | null
  emergency_phone: string
  present_address: string
  permanent_address?: string | null
  photo?: string | null
  status: string
  guardians?: Guardian[]
  current_enrollment?: StudentEnrollment | null
  currentEnrollment?: StudentEnrollment | null
  campus?: Campus
}

// Fees & Billing Domain Types
export interface FeeCategory {
  id: number
  campus_id: number
  name: string
  feeHeads?: FeeHead[]
  fee_heads?: FeeHead[]
}

export interface FeeHead {
  id: number
  fee_category_id: number
  name: string
  code: string
  is_refundable: boolean
  category?: FeeCategory
}

export interface FeeStructure {
  id: number
  academic_year_id: number
  class_id: number
  fee_head_id: number
  amount: number
  billing_frequency: string
  due_day_of_month: number
  fee_head?: FeeHead
  feeHead?: FeeHead
  classLevel?: ClassLevel
}

export interface StudentFeeWaiver {
  id: number
  student_id: number
  academic_year_id: number
  fee_head_id: number
  discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT'
  discount_value: number
  reason?: string | null
  student?: Student
  feeHead?: FeeHead
}

export interface FeeInstallment {
  id: number
  student_id: number
  academic_year_id: number
  fee_head_id: number
  installment_number: number
  due_date: string
  amount: number
  status: 'PENDING' | 'INVOICED' | 'PAID'
  invoice_id?: number | null
}

export interface StudentFeeAssignment {
  id: number
  campus_id: number
  student_id: number
  academic_year_id: number
  fee_head_id: number
  custom_amount?: number | null
  is_installment_enabled: boolean
  total_installments: number
  status: string
  notes?: string | null
  student?: Student
  feeHead?: FeeHead
  installments?: FeeInstallment[]
}

export interface InvoiceItem {
  id: number
  invoice_id: number
  fee_head_id: number
  description: string
  amount: number
  discount: number
  net_amount: number
  feeHead?: FeeHead
}

export interface PaymentAllocation {
  id: number
  payment_id: number
  invoice_id: number
  invoice_item_id?: number | null
  amount: number
  invoiceItem?: InvoiceItem
}

export interface Payment {
  id: number
  campus_id: number
  invoice_id: number
  receipt_number: string
  amount: number
  payment_method: string
  gateway_name?: string | null
  gateway_transaction_id?: string | null
  gateway_fee: number
  collected_by_user_id?: number | null
  status: 'COMPLETED' | 'REFUNDED' | 'REVERSED'
  paid_at: string
  invoice?: Invoice
  collectedBy?: User
  allocations?: PaymentAllocation[]
  refunds?: Refund[]
}

export interface Refund {
  id: number
  payment_id: number
  refund_reference: string
  amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED'
  reason: string
  requested_by_user_id?: number | null
  approved_by_user_id?: number | null
  rejection_reason?: string | null
  approved_at?: string | null
  gateway_refund_id?: string | null
  payment?: Payment
  requestedBy?: User
  approvedBy?: User
}

export interface PaymentAttempt {
  id: number
  invoice_id: number
  gateway_name: string
  tracking_ref: string
  idempotency_key?: string | null
  amount: number
  gateway_payment_id?: string | null
  status: 'INITIATED' | 'REDIRECTED' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
  error_message?: string | null
  created_at?: string
}

export interface PaymentReconciliation {
  id: number
  reconciliation_date: string
  gateway_name: string
  total_checked: number
  total_matched: number
  total_discrepancies: number
  discrepancy_details?: any
}

export interface CollectionSummary {
  campus_id: number
  start_date: string
  end_date: string
  total_transactions: number
  gross_collected: number
  total_refunded: number
  net_collected: number
  methods_breakdown: Record<string, { count: number; total: number }>
}

export interface OutstandingBalancesReport {
  campus_id: number
  academic_year_id: number
  total_invoices: number
  total_payable: number
  total_paid: number
  total_outstanding: number
  overdue_count: number
  overdue_amount: number
  status_breakdown: Record<string, number>
}

export interface Invoice {
  id: number
  campus_id: number
  student_id: number
  academic_year_id: number
  invoice_number: string
  month?: number | null
  year: number
  subtotal: number
  waiver_discount: number
  fine_amount: number
  total_payable: number
  total_paid: number
  issue_date: string
  due_date: string
  status: 'DRAFT' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  student?: Student
  items?: InvoiceItem[]
  payments?: Payment[]
  allocations?: PaymentAllocation[]
}

// Staff & Faculty Domain Types
export interface TeacherAssignment {
  id: number
  campus_id: number
  academic_year_id: number
  teacher_id: number
  class_id: number
  section_id: number
  subject_id?: number | null
  is_class_teacher: boolean
  status: string
  classLevel?: ClassLevel
  section?: Section
  subject?: Subject
  teacher?: Teacher
}

export interface Teacher {
  id: number
  staff_profile_id: number
  specialization_subject: string
  highest_degree: string
  name?: string
  is_on_leave?: boolean
  staffProfile?: StaffProfile
  staff_profile?: StaffProfile
  assignments?: TeacherAssignment[]
}

export interface StaffProfile {
  id: number
  campus_id: number
  user_id: number
  employee_id: string
  designation: string
  department: string
  joining_date: string
  basic_salary: number
  status: string
  user?: User
  teacher?: Teacher | null
  campus?: Campus
}

export interface StaffAttendanceItem {
  id?: number | null
  staff_profile_id: number
  employee_id: string
  name: string
  email?: string | null
  phone?: string | null
  department: string
  designation: string
  is_teacher: boolean
  specialization_subject?: string | null
  attendance_date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE'
  is_marked: boolean
  in_time?: string | null
  out_time?: string | null
}

export interface StaffAttendanceSummary {
  date: string
  total_staff: number
  marked_count: number
  present_count: number
  late_count: number
  half_day_count: number
  on_leave_count: number
  absent_count: number
  present_rate: number
}

// Admissions Pipeline Types
export interface AdmissionApplication {
  id: number
  campus_id: number
  academic_year_id: number
  class_id: number
  application_no: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  blood_group?: string | null
  religion?: string | null
  emergency_phone: string
  present_address: string
  permanent_address?: string | null
  previous_school?: string | null
  guardian_name: string
  guardian_phone: string
  guardian_email?: string | null
  guardian_relationship: string
  guardian_occupation?: string | null
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ENROLLED'
  reviewed_by?: number | null
  review_notes?: string | null
  reviewed_at?: string | null
  enrolled_student_id?: number | null
  classLevel?: ClassLevel
  academicYear?: AcademicYear
  reviewer?: User | null
  enrolledStudent?: Student | null
}

// Attendance Domain Types
export interface StudentAttendance {
  id: number
  attendance_session_id: number
  student_id: number
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'LEAVE'
  check_in_time?: string | null
  remarks?: string | null
  marked_by_user_id?: number | null
  updated_by_user_id?: number | null
  correction_reason?: string | null
  corrected_at?: string | null
  student?: Student
  markedBy?: User
  updatedBy?: User
  correctionLogs?: AttendanceCorrectionLog[]
}

export interface AttendanceCorrectionLog {
  id: number
  student_attendance_id: number
  attendance_session_id: number
  student_id: number
  old_status: string
  new_status: string
  changed_by_user_id: number
  reason: string
  created_at: string
  changedBy?: User
}

export interface AttendanceSession {
  id: number
  campus_id: number
  academic_year_id: number
  section_id: number
  session_date: string
  type: 'DAILY_HOMEROOM' | 'PERIOD_WISE'
  period_id?: number | null
  taken_by_user_id: number
  is_locked: boolean
  locked_by_user_id?: number | null
  locked_at?: string | null
  section?: Section
  period?: Period
  takenBy?: User
  taken_by?: User
  lockedBy?: User
  locked_by?: User
  studentAttendances?: StudentAttendance[]
  student_attendances?: StudentAttendance[]
  total_marked?: number
  present_count?: number
  absent_count?: number
  late_count?: number
}

export interface AttendanceSummary {
  section_id: number
  start_date: string
  end_date: string
  sessions_count: number
  total_marked: number
  present: number
  absent: number
  late: number
  excused: number
  leave: number
  attendance_rate: number
}

// Timetable Domain Types
export interface Period {
  id: number
  shift_id: number
  period_number: number
  name: string
  start_time: string
  end_time: string
  is_break: boolean
  shift?: Shift
}

export interface TimetableSlot {
  id: number
  campus_id: number
  academic_year_id: number
  timetable_version_id?: number | null
  section_id: number
  subject_id: number
  teacher_id: number
  room_id: number
  period_id: number
  day_of_week: number
  is_teacher_on_leave?: boolean
  subject?: Subject
  teacher?: Teacher
  classroom?: Classroom
  period?: Period
  section?: Section
  version?: TimetableVersion
}

export interface TimetableVersion {
  id: number
  campus_id: number
  academic_year_id: number
  name: string
  version_number: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  effective_from: string
  created_by_user_id?: number | null
  published_by_user_id?: number | null
  published_at?: string | null
  change_summary?: string | null
  createdBy?: User
  publishedBy?: User
  entries?: TimetableSlot[]
  entries_count?: number
}

// Examination & Result Publication Domain Types
export interface GradingScale {
  id: number
  name: string
  letter_grade: string
  min_marks_percentage: number | string
  max_marks_percentage: number | string
  grade_point: number | string
  remarks?: string
}

export interface ExamSubject {
  id: number
  exam_id: number
  subject_id: number
  exam_date: string
  start_time: string
  end_time: string
  max_creative_marks: number | string
  max_mcq_marks: number | string
  max_practical_marks: number | string
  max_ca_marks: number | string
  total_max_marks: number | string
  pass_marks: number | string
  subject?: Subject
}

export interface Exam {
  id: number
  campus_id: number
  academic_year_id: number
  term_id: number
  name: string
  start_date: string
  end_date: string
  status: 'SCHEDULED' | 'MARKS_ENTRY_OPEN' | 'MARKS_SUBMITTED' | 'RESULT_APPROVED' | 'PUBLISHED' | 'ARCHIVED'
  approved_by_user_id?: number | null
  approved_at?: string | null
  published_at?: string | null
  academic_year?: AcademicYear
  term?: AcademicTerm
  campus?: Campus
  exam_subjects?: ExamSubject[]
  exam_subjects_count?: number
  publication_versions_count?: number
}

export interface ExamMarkSubmission {
  id: number
  exam_subject_id: number
  section_id: number
  submitted_by_user_id: number
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PUBLISHED'
  total_students: number
  passed_count: number
  failed_count: number
  absent_count: number
  submitted_at?: string | null
  reviewed_by_user_id?: number | null
  reviewed_at?: string | null
  rejection_reason?: string | null
  approval_notes?: string | null
  exam_subject?: ExamSubject
  section?: Section
  submitted_by?: User
  reviewed_by?: User
}

export interface StudentMarkRow {
  student_id: number
  student_uid: string
  student_name: string
  roll_number: number
  gender?: string
  creative_marks: number
  mcq_marks: number
  practical_marks: number
  ca_marks: number
  total_obtained: number
  grade_point: number
  letter_grade: string
  is_absent: boolean
  is_passed: boolean
  status: string
  remarks?: string | null
}

export interface ResultPublicationVersion {
  id: number
  campus_id: number
  exam_id: number
  class_id: number
  section_id?: number | null
  version_number: number
  version_code: string
  title: string
  status: 'PUBLISHED' | 'SUPERSEDED' | 'WITHHELD'
  total_students: number
  passed_students: number
  failed_students: number
  pass_percentage: number | string
  average_gpa: number | string
  highest_total_marks: number | string
  published_by_user_id: number
  published_at: string
  change_summary?: string | null
  class_level?: ClassLevel
  section?: Section
  published_by?: User
  exam?: Exam
}

export interface ReportCardData {
  report_card_id: string
  institution: {
    name: string
    campus: string
    campus_code: string
    affiliation: string
    motto: string
  }
  student: {
    id: number
    student_uid: string
    name: string
    gender: string
    roll_number: number | string
    class: string
    section: string
    blood_group: string
  }
  examination: {
    id: number
    name: string
    term: string
    academic_year: string
    start_date: string
    end_date: string
  }
  publication: {
    version_code: string
    published_at: string
    status: string
    is_active: boolean
  }
  results_summary: {
    total_marks: number
    total_max_marks: number
    overall_percentage: number
    gpa: number
    gpa_without_fourth_subject: number
    final_grade: string
    class_rank: number | null
    section_rank: number | null
    is_passed: boolean
    result_status: string
    teacher_remarks: string
    principal_remarks: string
  }
  attendance: {
    total_days: number
    present_days: number
    absent_days: number
    late_days: number
    percentage: number
  }
  subject_marks: Array<{
    exam_subject_id: number
    subject_name: string
    subject_code: string
    max_creative: number
    max_mcq: number
    max_practical: number
    max_ca: number
    total_max: number
    pass_marks: number
    creative_obtained: number
    mcq_obtained: number
    practical_obtained: number
    ca_obtained: number
    total_obtained: number
    highest_in_class: number
    grade_point: number
    letter_grade: string
    is_absent: boolean
    is_passed: boolean
  }>
  grading_scale_reference: Array<{
    letter_grade: string
    grade_point: number | string
    min_marks_percentage: number | string
    max_marks_percentage: number | string
    remarks: string
  }>
  verification: {
    hash: string
    verified: boolean
    certified_by: string
  }
}

// =========================================================================
// Communications, Notice Board, Announcements & Notifications
// =========================================================================

export interface Notice {
  id: number
  campus_id: number
  author_id?: number | null
  author?: User | null
  campus?: Campus | null
  title: string
  content: string
  category: 'ACADEMIC' | 'ADMINISTRATIVE' | 'HOLIDAY' | 'EMERGENCY' | 'EVENT' | 'GENERAL'
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  target_audience: 'ALL' | 'TEACHERS' | 'STUDENTS' | 'PARENTS'
  is_pinned: boolean
  attachment_url?: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  is_published: boolean
  published_at?: string | null
  expires_at?: string | null
  created_at: string
  updated_at: string
}

export interface Announcement {
  id: number
  campus_id: number
  author_id: number
  author?: User | null
  title: string
  content: string
  target_type: 'INSTITUTION' | 'CAMPUS' | 'CLASS' | 'SECTION' | 'ROLE' | 'INDIVIDUAL'
  target_class_id?: number | null
  target_class?: ClassLevel | null
  target_section_id?: number | null
  target_section?: Section | null
  target_role?: string | null
  target_user_ids?: number[] | null
  channels: Array<'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH'>
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED'
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  scheduled_at?: string | null
  expires_at?: string | null
  published_at?: string | null
  approved_by_user_id?: number | null
  approved_by?: User | null
  approved_at?: string | null
  recipients_count: number
  delivered_count: number
  created_at: string
  updated_at: string
}

export interface NotificationTemplate {
  id: number
  code: string
  name: string
  category: string
  title_template: string
  in_app_template: string
  email_subject?: string | null
  email_body?: string | null
  sms_template?: string | null
  push_template?: string | null
  available_placeholders: string[]
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface UserNotification {
  id: number
  user_id: number
  title: string
  body: string
  message?: string
  type: string
  category: string
  action_url?: string | null
  icon: string
  priority: string
  is_read: boolean
  read_at?: string | null
  created_at: string
  updated_at: string
}

export interface UserNotificationPreference {
  id?: number
  user_id?: number
  category: string
  in_app: boolean
  email: boolean
  sms: boolean
  push: boolean
}

export interface NotificationDeliveryLog {
  id: number
  user_id?: number | null
  user?: User | null
  announcement_id?: number | null
  template_code?: string | null
  recipient_type: string
  recipient_id: string
  destination: string
  channel: 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH'
  message_body: string
  category: string
  delivery_status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRYING'
  provider_name?: string
  provider_error_code?: string | null
  provider_error_message?: string | null
  attempts: number
  max_attempts: number
  cost_incurred: number
  sent_at?: string | null
  delivered_at?: string | null
  created_at: string
}
