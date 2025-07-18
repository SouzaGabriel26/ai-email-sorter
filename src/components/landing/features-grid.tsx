import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ArrowRight, Bot, Mail, Shield, Users, Zap } from "lucide-react"

const features = [
  {
    icon: Bot,
    title: "AI-Powered Sorting",
    description: "Advanced AI automatically categorizes your emails based on custom descriptions you provide",
    color: "text-blue-600"
  },
  {
    icon: Zap,
    title: "Smart Summaries",
    description: "Get instant AI-generated summaries of your emails to quickly understand what matters most",
    color: "text-green-600"
  },
  {
    icon: Users,
    title: "Multiple Accounts",
    description: "Connect and manage multiple Gmail accounts from a single, unified dashboard",
    color: "text-purple-600"
  },
  {
    icon: Shield,
    title: "Bulk Actions",
    description: "Delete, archive, or unsubscribe from multiple emails at once with intelligent automation",
    color: "text-red-600"
  },
  {
    icon: Mail,
    title: "Gmail Integration",
    description: "Seamless integration with Gmail - changes sync automatically with your inbox",
    color: "text-indigo-600"
  },
  {
    icon: ArrowRight,
    title: "Real-time Processing",
    description: "New emails are processed and categorized automatically as they arrive",
    color: "text-orange-600"
  }
]

export function FeaturesGrid() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
      {features.map((feature, index) => {
        const IconComponent = feature.icon
        return (
          <Card key={index} className="text-center p-6 shadow-md hover:shadow-lg transition-shadow">
            <IconComponent className={cn("h-12 w-12 mx-auto mb-4", feature.color)} />
            <h3 className={cn("text-xl font-semibold mb-3")}>{feature.title}</h3>
            <p className={cn("text-gray-600")}>{feature.description}</p>
          </Card>
        )
      })}
    </div>
  )
} 