import React from 'react'
import { Button } from '@/components/ui/Button'

interface GoogleAuthButtonProps {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ children, disabled, onClick }) => (
  <Button
    type="button"
    variant="outline"
    size="lg"
    disabled={disabled}
    onClick={onClick}
    className="w-full bg-white dark:bg-[#1E293B]"
  >
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.2-1.8 13.6-4.9l-6.7-5.1c-1.9 1.3-4.2 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.7v5.2A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.7a20 20 0 0 0 0 17.6l6.9-5.2Z" />
      <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9C34.2 6 29.5 4 24 4A20 20 0 0 0 5.7 15.2l6.9 5.2C14.2 15.6 18.7 12 24 12Z" />
    </svg>
    {children}
  </Button>
)
