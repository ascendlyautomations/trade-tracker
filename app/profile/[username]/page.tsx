"use client"

import Navbar from "../../components/Navbar"
import { useEffect, useState } from "react"
import { supabase } from "../../../lib/supabaseClient"
import { useParams } from "next/navigation"

export default function ProfilePage() {
  const params = useParams()
  const username = params.username as string

  const [profile, setProfile] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
  }, [username])

  async function fetchProfile() {
    setLoading(true)

    // 🔥 UPDATED: include avatar_url
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("id, username, name, bio, avatar_url")
      .eq("username", username)
      .single()

    if (!prof || error) {
      setLoading(false)
      return
    }

    setProfile(prof)

    const { data: tradesData } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", prof.id)
      .order("created_at", { ascending: false })

    setTrades(tradesData || [])
    setLoading(false)
  }

  // 🔥 STATS
  const totalTrades = trades.length
  const wins = trades.filter((t) => t.pnl > 0)
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const winRate = totalTrades ? (wins.length / totalTrades) * 100 : 0
  const bestTrade = Math.max(...trades.map((t) => t.pnl || 0), 0)

  function formatCurrency(value: number) {
    return `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString()}`
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="text-center mt-20 text-gray-400">Loading profile...</div>
      </>
    )
  }

  if (!profile) {
    return (
      <>
        <Navbar />
        <div className="text-center mt-20 text-red-400">User not found</div>
      </>
    )
  }

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#065f46] text-white p-6">

        <div className="max-w-5xl mx-auto">

          {/* 🔥 HEADER */}
          <div className="flex items-center gap-6 mb-10">

            {/* 🔥 UPDATED AVATAR */}
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-2xl font-bold">
                {profile.username?.[0]?.toUpperCase()}
              </div>
            )}

            {/* Info */}
            <div>
              <h1 className="text-2xl font-semibold">
                {profile.name || "User"}
              </h1>

              <p className="text-gray-400">
                @{profile.username}
              </p>

              {profile.bio ? (
                <p className="mt-2 text-sm text-gray-300 max-w-md">
                  {profile.bio}
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-500 italic">
                  No bio yet
                </p>
              )}
            </div>

          </div>

          {/* 🔥 STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">

            <Stat title="Trades" value={totalTrades} />

            <Stat title="Win %" value={`${winRate.toFixed(1)}%`} />

            <Stat
              title="Total P&L"
              value={formatCurrency(totalPnL)}
              positive={totalPnL >= 0}
            />

            <Stat
              title="Best Trade"
              value={formatCurrency(bestTrade)}
              positive={bestTrade >= 0}
            />

          </div>

          {/* 🔥 TRADES */}
          <div>

            <h2 className="text-xl mb-4 font-semibold">
              Trades
            </h2>

            {trades.length === 0 ? (
              <p className="text-gray-400">No trades yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {trades.map((trade) => (
                  <div
                    key={trade.id}
                    className="bg-white/5 border border-white/10 p-4 rounded-xl"
                  >

                    <p className="font-semibold">
                      {trade.ticker} • {trade.direction}
                    </p>

                    <p className={trade.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                      {formatCurrency(trade.pnl)}
                    </p>

                    {trade.image_url && (
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/${trade.image_url}`}
                        className="mt-3 rounded-lg"
                      />
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(trade.created_at).toLocaleDateString()}
                    </p>

                  </div>
                ))}

              </div>
            )}

          </div>

        </div>

      </div>
    </>
  )
}

function Stat({ title, value, positive }: any) {
  let color = "text-white"
  if (positive === true) color = "text-green-400"
  if (positive === false) color = "text-red-400"

  return (
    <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-center">
      <p className="text-xs text-blue-300">{title}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  )
}