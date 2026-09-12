import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { resetHttpSecurityState } from '../lib/http'

afterEach(() => resetHttpSecurityState())

