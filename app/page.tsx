import { SiteHeader } from "@/components/landing/site-header"
import { Hero } from "@/components/landing/hero"
import { RoleCards } from "@/components/landing/role-cards"
import { FeatureGrid } from "@/components/landing/feature-grid"
import { BuildStatus } from "@/components/landing/build-status"
import { SiteFooter } from "@/components/landing/site-footer"

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <RoleCards />
        <FeatureGrid />
        <BuildStatus />
      </main>
      <SiteFooter />
    </div>
  )
}
