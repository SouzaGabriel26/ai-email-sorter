"use client"

import { GoogleIcon } from "@/components/icons/google-icon"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { signIn } from "next-auth/react"

export function HeroSection() {
  return (
    <div className="text-center mb-16">
      <h1 className="text-5xl font-bold text-gray-900 mb-6">
        Your AI-Powered Email Assistant
      </h1>
      <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
        Let AI organize, summarize, and manage your Gmail inbox automatically.
        Connect multiple accounts, create custom categories, and take bulk actions
        with intelligent automation.
      </p>

      {/* Sign In Card */}
      <Card className="max-w-md mx-auto mb-16 shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Get Started</CardTitle>
          <CardDescription>
            Sign in with your Google account to begin organizing your emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => signIn("google")}
            className="w-full h-12 text-lg cursor-pointer"
            size="lg"
          >
            <GoogleIcon className="w-5 h-5 mr-3" />
            Continue with Google
          </Button>
          <p className="text-sm text-gray-500 text-center">
            We&apos;ll request Gmail permissions to read and organize your emails
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 