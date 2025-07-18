import { cn } from "@/lib/utils"

const steps = [
  {
    number: 1,
    title: "Connect Your Gmail",
    description: "Sign in and grant permissions to access your Gmail accounts",
    color: "blue"
  },
  {
    number: 2,
    title: "Create Categories",
    description: "Define custom categories with descriptions for AI to use",
    color: "green"
  },
  {
    number: 3,
    title: "Let AI Work",
    description: "Watch as AI automatically sorts and summarizes your emails",
    color: "purple"
  }
]

const getColorClasses = (color: string) => {
  const colorMap = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600"
  }
  return colorMap[color as keyof typeof colorMap] || colorMap.blue
}

export function HowItWorks() {
  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">How It Works</h2>
      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((step) => (
          <div key={step.number} className="text-center">
            <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4", getColorClasses(step.color))}>
              <span className="text-2xl font-bold">{step.number}</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
            <p className="text-gray-600">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
} 