import { describe, expect, it } from 'vitest'
import {
  friendlyLoginError,
  friendlyPasswordResetError,
  friendlyProfileError,
  friendlyRegisterError
} from './auth-errors'

describe('friendlyLoginError', () => {
  it('maps 400/401 to a generic credentials message', () => {
    expect(friendlyLoginError({ status: 400, message: 'Failed to authenticate.' })).toBe(
      'Email or password is incorrect.'
    )
    expect(friendlyLoginError({ status: 401, data: { identity: { message: 'raw' } } })).toBe(
      'Email or password is incorrect.'
    )
  })

  it('does not leak PocketBase payloads', () => {
    const msg = friendlyLoginError({
      status: 400,
      message: 'Something went wrong while processing your request.',
      response: { data: { identity: { message: 'sql: no rows' } } }
    })
    expect(msg).toBe('Email or password is incorrect.')
    expect(msg.toLowerCase()).not.toContain('sql')
  })
})

describe('friendlyRegisterError', () => {
  it('maps duplicate email', () => {
    expect(
      friendlyRegisterError({
        status: 400,
        response: { data: { email: { code: 'validation_not_unique', message: 'Value must be unique.' } } }
      })
    ).toBe('That email is already registered.')
  })

  it('maps password mismatch', () => {
    expect(
      friendlyRegisterError({
        status: 400,
        data: { data: { passwordConfirm: { message: 'Values do not match.' } } }
      })
    ).toBe('Passwords do not match.')
  })
})

describe('friendlyPasswordResetError', () => {
  it('hides token internals', () => {
    expect(friendlyPasswordResetError({ status: 400, message: 'invalid or expired token' })).toBe(
      'Failed to reset password. The link may be invalid or expired.'
    )
  })
})

describe('friendlyProfileError', () => {
  it('maps expired sessions', () => {
    expect(friendlyProfileError({ status: 401 })).toBe('Your session expired. Log out, then log in again.')
  })
})
