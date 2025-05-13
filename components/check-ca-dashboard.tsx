import DeveloperBubbleMap from "./developer-bubble-map"

interface CheckCADashboardProps {
  developerAddress: string
}

export function CheckCADashboard({ developerAddress }: CheckCADashboardProps) {
  return (
    <div>
      <DeveloperBubbleMap developerAddress={developerAddress} />
    </div>
  )
}
