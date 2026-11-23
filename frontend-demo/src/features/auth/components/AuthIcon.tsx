import { AppIcon, type AppIconName } from '../../../shared/components/AppIcon'

type AuthIconName = Extract<
  AppIconName,
  | 'arrowRight'
  | 'check'
  | 'eye'
  | 'eyeOff'
  | 'info'
  | 'key'
  | 'lock'
  | 'logout'
  | 'user'
>

interface AuthIconProps {
  name: AuthIconName
}

export function AuthIcon({ name }: AuthIconProps) {
  return <AppIcon name={name} />
}
