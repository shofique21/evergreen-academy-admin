import { describe, it, expect } from 'vitest'
import { authRoutes } from '../src/app/router/auth.routes'
import { adminRoutes } from '../src/app/router/admin.routes'
import { teacherRoutes } from '../src/app/router/teacher.routes'
import { studentRoutes } from '../src/app/router/student.routes'
import { parentRoutes } from '../src/app/router/parent.routes'

describe('Portal Route Groups Architecture', () => {
  it('defines auth route group with login, mfa, and forgot-password', () => {
    expect(authRoutes).toBeDefined()
    const authRoot = authRoutes.find((r) => r.path === '/auth')
    expect(authRoot).toBeDefined()
    const childPaths = authRoot?.children?.map((c) => c.path)
    expect(childPaths).toContain('login')
    expect(childPaths).toContain('mfa')
    expect(childPaths).toContain('forgot-password')
  })

  it('defines admin route group protected with admin/super_admin roles and 13 children', () => {
    expect(adminRoutes).toBeDefined()
    const adminRoot = adminRoutes.find((r) => r.path === '/admin')
    expect(adminRoot).toBeDefined()
    expect(adminRoot?.meta?.requiresAuth).toBe(true)
    expect(adminRoot?.meta?.roles).toContain('admin')

    const childPaths = adminRoot?.children?.map((c) => c.path)
    expect(childPaths).toContain('dashboard')
    expect(childPaths).toContain('users')
    expect(childPaths).toContain('teachers')
    expect(childPaths).toContain('students')
    expect(childPaths).toContain('admissions')
    expect(childPaths).toContain('attendance')
    expect(childPaths).toContain('timetable')
    expect(childPaths).toContain('examinations')
    expect(childPaths).toContain('fees')
    expect(childPaths).toContain('payments')
    expect(childPaths).toContain('notices')
    expect(childPaths).toContain('notifications')
    expect(childPaths).toContain('reports')
  })

  it('defines teacher route group with faculty access', () => {
    expect(teacherRoutes).toBeDefined()
    const teacherRoot = teacherRoutes.find((r) => r.path === '/teacher')
    expect(teacherRoot).toBeDefined()
    expect(teacherRoot?.meta?.requiresAuth).toBe(true)
    expect(teacherRoot?.meta?.roles).toContain('teacher')

    const childPaths = teacherRoot?.children?.map((c) => c.path)
    expect(childPaths).toContain('dashboard')
    expect(childPaths).toContain('attendance')
    expect(childPaths).toContain('examinations')
    expect(childPaths).toContain('timetable')
  })

  it('defines student route group with student access', () => {
    expect(studentRoutes).toBeDefined()
    const studentRoot = studentRoutes.find((r) => r.path === '/student')
    expect(studentRoot).toBeDefined()
    expect(studentRoot?.meta?.requiresAuth).toBe(true)
    expect(studentRoot?.meta?.roles).toContain('student')

    const childPaths = studentRoot?.children?.map((c) => c.path)
    expect(childPaths).toContain('dashboard')
    expect(childPaths).toContain('fees')
    expect(childPaths).toContain('payments')
    expect(childPaths).toContain('examinations')
  })

  it('defines parent route group with guardian access', () => {
    expect(parentRoutes).toBeDefined()
    const parentRoot = parentRoutes.find((r) => r.path === '/parent')
    expect(parentRoot).toBeDefined()
    expect(parentRoot?.meta?.requiresAuth).toBe(true)
    expect(parentRoot?.meta?.roles).toContain('parent')

    const childPaths = parentRoot?.children?.map((c) => c.path)
    expect(childPaths).toContain('dashboard')
    expect(childPaths).toContain('attendance')
    expect(childPaths).toContain('fees')
    expect(childPaths).toContain('payments')
  })
})
