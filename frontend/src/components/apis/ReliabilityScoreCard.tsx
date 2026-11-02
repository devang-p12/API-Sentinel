import { useState, useEffect, useCallback } from "react"
import { api, type ReliabilityScoreBreakdown } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface ReliabilityScoreCardProps {
  apiId: string
  environmentId?: string
}

export function ReliabilityScoreCard({ apiId, environmentId }: ReliabilityScoreCardProps) {
  const [scoreData, setScoreData] = useState<ReliabilityScoreBreakdown | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchScore = useCallback(async () => {
    try {
      setError(null)
      const data = await api.getReliabilityScore(apiId, { environmentId, limit: 100 })
      setScoreData(data)
    } catch (err: any) {
      console.error("Failed to fetch reliability score:", err)
      setError(err?.message || "Could not calculate reliability score")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [apiId, environmentId])

  useEffect(() => {
    setIsLoading(true)
    fetchScore()
  }, [fetchScore])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchScore()
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
    if (score >= 80) return "text-blue-400 border-blue-500/40 bg-blue-500/10"
    if (score >= 70) return "text-amber-400 border-amber-500/40 bg-amber-500/10"
    if (score >= 50) return "text-orange-400 border-orange-500/40 bg-orange-500/10"
    return "text-rose-400 border-rose-500/40 bg-rose-500/10"
  }

  const getProgressColor = (score: number) => {
    if (score >= 90) return "bg-emerald-500"
    if (score >= 80) return "bg-blue-500"
    if (score >= 70) return "bg-amber-500"
    if (score >= 50) return "bg-orange-500"
    return "bg-rose-500"
  }

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between animate-pulse">
            <div className="space-y-2">
              <div className="h-4 w-40 bg-muted/60 rounded" />
              <div className="h-3 w-64 bg-muted/40 rounded" />
            </div>
            <div className="h-12 w-20 bg-muted/60 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !scoreData) {
    return (
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">API Reliability Score</p>
            <p className="text-xs text-muted-foreground">{error || "No monitor evaluation checks available yet."}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Recalculate
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { overallScore, grade, sampleCount, dimensions, summary } = scoreData

  return (
    <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-lg overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-lg font-semibold tracking-tight">API Reliability Score</CardTitle>
              <Badge variant="outline" className={`font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full ${getScoreColor(overallScore)}`}>
                {grade}
              </Badge>
            </div>
            <CardDescription className="text-xs mt-1 text-muted-foreground">
              Deterministic health index computed over {sampleCount} server-side checks across 5 core reliability dimensions.
            </CardDescription>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1.5 px-4 py-2 bg-background/60 rounded-xl border border-border/60 shadow-inner">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${getScoreColor(overallScore).split(" ")[0]}`}>
                {Math.round(overallScore)}
              </span>
              <span className="text-xs text-muted-foreground font-mono font-medium">/ 100</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={handleRefresh}
              className="text-xs h-9 px-3"
            >
              {isRefreshing ? "Recalculating..." : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        {/* Dimensions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Availability */}
          <div className="p-3.5 rounded-xl border border-border/40 bg-background/40 hover:bg-background/70 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Availability</span>
              <span className="text-xs font-mono font-bold text-foreground">
                {dimensions.availability.score}
                <span className="text-[10px] text-muted-foreground font-normal"> ({dimensions.availability.weight * 100}%)</span>
              </span>
            </div>
            <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(dimensions.availability.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, dimensions.availability.score))}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {dimensions.availability.description}
            </p>
          </div>

          {/* 2. Latency */}
          <div className="p-3.5 rounded-xl border border-border/40 bg-background/40 hover:bg-background/70 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Latency</span>
              <span className="text-xs font-mono font-bold text-foreground">
                {dimensions.latency.score}
                <span className="text-[10px] text-muted-foreground font-normal"> ({dimensions.latency.weight * 100}%)</span>
              </span>
            </div>
            <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(dimensions.latency.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, dimensions.latency.score))}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {dimensions.latency.description}
            </p>
          </div>

          {/* 3. Errors */}
          <div className="p-3.5 rounded-xl border border-border/40 bg-background/40 hover:bg-background/70 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Errors</span>
              <span className="text-xs font-mono font-bold text-foreground">
                {dimensions.errors.score}
                <span className="text-[10px] text-muted-foreground font-normal"> ({dimensions.errors.weight * 100}%)</span>
              </span>
            </div>
            <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(dimensions.errors.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, dimensions.errors.score))}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {dimensions.errors.description}
            </p>
          </div>

          {/* 4. Latency Stability */}
          <div className="p-3.5 rounded-xl border border-border/40 bg-background/40 hover:bg-background/70 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Stability (Jitter)</span>
              <span className="text-xs font-mono font-bold text-foreground">
                {dimensions.latencyStability.score}
                <span className="text-[10px] text-muted-foreground font-normal"> ({dimensions.latencyStability.weight * 100}%)</span>
              </span>
            </div>
            <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(dimensions.latencyStability.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, dimensions.latencyStability.score))}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {dimensions.latencyStability.description}
            </p>
          </div>

          {/* 5. Schema Stability */}
          <div className="p-3.5 rounded-xl border border-border/40 bg-background/40 hover:bg-background/70 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Schema</span>
              <span className="text-xs font-mono font-bold text-foreground">
                {dimensions.schema.score}
                <span className="text-[10px] text-muted-foreground font-normal"> ({dimensions.schema.weight * 100}%)</span>
              </span>
            </div>
            <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(dimensions.schema.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, dimensions.schema.score))}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {dimensions.schema.description}
            </p>
          </div>
        </div>

        {/* Narrative Summary */}
        <div className="p-3 bg-muted/20 border border-border/30 rounded-lg text-xs text-muted-foreground flex items-center justify-between">
          <span>{summary}</span>
          <span className="text-[10px] font-mono opacity-60">Formula: Deterministic Weighted SRE Matrix</span>
        </div>
      </CardContent>
    </Card>
  )
}
