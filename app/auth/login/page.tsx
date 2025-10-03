"use client"

import { useEffect, useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Loader2, AlertCircle, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [retryAfter, setRetryAfter] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const router = useRouter()

  useEffect(() => {
    // Redirect if already logged in
    getSession().then((session) => {
      if (session) {
        router.push("/dashboard")
      }
    })
  }, [router])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  // Countdown timer for rate limiting
  const startCountdown = (seconds: number) => {
    setCountdown(seconds)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setIsRateLimited(false)
          setError("")
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const onSubmit = async (data: LoginInput) => {
    try {
      setIsLoading(true)
      setError("")

      // First, try our custom rate-limited endpoint
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      })

      const loginData = await loginResponse.json()

      // Handle rate limiting
      if (loginResponse.status === 429) {
        setIsRateLimited(true)
        setRetryAfter(loginData.retryAfter || 300)
        setError(`Too many login attempts. Please wait ${formatTime(loginData.retryAfter || 300)} before trying again.`)
        startCountdown(loginData.retryAfter || 300)
        return
      }

      // Handle other login errors
      if (!loginResponse.ok) {
        if (loginData.error === 'Invalid credentials') {
          setError("Invalid email or password. Please check your credentials and try again.")
        } else if (loginData.error === 'Account is deactivated') {
          setError("Your account has been deactivated. Please contact support.")
        } else {
          setError(loginData.error || "Login failed. Please try again.")
        }
        return
      }

      // If login successful, use NextAuth for session management
      if (loginData.success) {
        const result = await signIn("credentials", {
          email: data.email,
          password: data.password,
          redirect: false,
        })

        if (result?.error) {
          setError("Session creation failed. Please try again.")
          return
        }

        // Get session to verify login
        const session = await getSession()
        if (session) {
          router.push("/dashboard")
          router.refresh()
        }
      }
    } catch (error: any) {
      console.error("Login error:", error)

      // Check if it's a network error that might indicate rate limiting
      if (error.message.includes('fetch')) {
        setError("Connection error. Please check your internet connection.")
      } else {
        setError("An unexpected error occurred. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">Sign in to your CRM account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant={isRateLimited ? "destructive" : "destructive"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {isRateLimited ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">Account Temporarily Locked</span>
                      </div>
                      <div className="text-sm">
                        Too many failed login attempts. Please wait{" "}
                        <span className="font-mono bg-muted px-1 py-0.5 rounded">
                          {formatTime(countdown)}
                        </span>{" "}
                        before trying again.
                      </div>
                      <div className="text-xs text-muted-foreground">
                        This security measure protects your account from unauthorized access attempts.
                      </div>
                    </div>
                  ) : (
                    error
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...register("email")}
                className={errors.email ? "border-destructive" : ""}
                disabled={isRateLimited}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...register("password")}
                  className={errors.password ? "border-destructive pr-10" : "pr-10"}
                  disabled={isRateLimited}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isRateLimited}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isRateLimited}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRateLimited ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Locked ({formatTime(countdown)})
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            {isRateLimited && (
              <p className="text-xs text-center text-muted-foreground">
                🛡️ Security measure active. Your account is protected from brute force attacks.
              </p>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
