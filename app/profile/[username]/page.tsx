"use client"

import Navbar from "../../components/Navbar"
import { useEffect, useState } from "react"
import { supabase } from "../../../lib/supabaseClient"
import { useParams, useRouter } from "next/navigation"

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string

  const [profile, setProfile] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [messageBusy, setMessageBusy] = useState(false)
  const [showFollowers, setShowFollowers] = useState(false)
  const [showFollowing, setShowFollowing] = useState(false)
  const [followersModalUsers, setFollowersModalUsers] = useState<any[]>([])
  const [followingModalUsers, setFollowingModalUsers] = useState<any[]>([])

  useEffect(() => {
    fetchProfile()
  }, [username])

  async function fetchProfile() {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData?.session?.user?.id ?? null
    setCurrentUserId(uid)

    // 🔥 UPDATED: include avatar_url
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("id, username, name, bio, avatar_url")
      .eq("username", username)
      .single()

    if (!prof || error) {
      setProfile(null)
      setFollowersCount(0)
      setFollowingCount(0)
      setIsFollowing(false)
      setLoading(false)
      return
    }

    setProfile(prof)

    if (uid && uid !== prof.id) {
      const { data: followRow } = await supabase
        .from("followers")
        .select("*")
        .eq("follower_id", uid)
        .eq("following_id", prof.id)
        .maybeSingle()

      setIsFollowing(!!followRow)
    } else {
      setIsFollowing(false)
    }

    const { count: followersN } = await supabase
      .from("followers")
      .select("*", { count: "exact", head: true })
      .eq("following_id", prof.id)

    const { count: followingN } = await supabase
      .from("followers")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", prof.id)

    setFollowersCount(followersN ?? 0)
    setFollowingCount(followingN ?? 0)

    const { data: tradesData } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", prof.id)
      .order("created_at", { ascending: false })

    setTrades(tradesData || [])
    setLoading(false)
  }

  async function handleFollowToggle() {
    if (!currentUserId || !profile || currentUserId === profile.id || followBusy)
      return

    setFollowBusy(true)

    if (isFollowing) {
      await supabase
        .from("followers")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", profile.id)

      setIsFollowing(false)
    } else {
      await supabase.from("followers").insert({
        follower_id: currentUserId,
        following_id: profile.id,
      })

      setIsFollowing(true)
    }

    const { count: followersN } = await supabase
      .from("followers")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id)

    setFollowersCount(followersN ?? 0)

    setFollowBusy(false)
  }

  async function findExistingDmConversationId(
    me: string,
    them: string
  ): Promise<string | null> {
    const { data: mine } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", me)

    const ids = [...new Set(mine?.map((r) => r.conversation_id) ?? [])]
    if (ids.length === 0) return null

    const { data: rows } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", ids)

    const byConvo = new Map<string, Set<string>>()
    for (const row of rows ?? []) {
      if (!byConvo.has(row.conversation_id)) {
        byConvo.set(row.conversation_id, new Set())
      }
      byConvo.get(row.conversation_id)!.add(row.user_id)
    }

    for (const [cid, users] of byConvo) {
      if (users.size === 2 && users.has(me) && users.has(them)) return cid
    }

    return null
  }

  async function handleMessage() {
    if (!currentUserId || !profile || currentUserId === profile.id) return

    setMessageBusy(true)
    try {
      const existingId = await findExistingDmConversationId(
        currentUserId,
        profile.id
      )

      if (existingId) {
        router.push(`/messages/${existingId}`)
        return
      }

      const { data: convo, error: convErr } = await supabase
        .from("conversations")
        .insert({})
        .select("id")
        .single()

      if (convErr || !convo?.id) {
        console.error(convErr)
        return
      }

      const { error: partErr } = await supabase
        .from("conversation_participants")
        .insert([
          { conversation_id: convo.id, user_id: currentUserId },
          { conversation_id: convo.id, user_id: profile.id },
        ])

      if (partErr) {
        console.error(partErr)
        return
      }

      router.push(`/messages/${convo.id}`)
    } finally {
      setMessageBusy(false)
    }
  }

  function closeFollowModals() {
    setShowFollowers(false)
    setShowFollowing(false)
  }

  /** People who follow this profile: followers.following_id = profile.id → load their profiles */
  async function openFollowersModal() {
    if (!profile) return
    setShowFollowing(false)
    setShowFollowers(true)

    const { data: rows } = await supabase
      .from("followers")
      .select("follower_id")
      .eq("following_id", profile.id)

    const ids = [...new Set(rows?.map((r) => r.follower_id).filter(Boolean) ?? [])]
    if (ids.length === 0) {
      setFollowersModalUsers([])
      return
    }

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, name")
      .in("id", ids)

    setFollowersModalUsers(profs ?? [])
  }

  /** People this profile follows: followers.follower_id = profile.id → load followed profiles */
  async function openFollowingModal() {
    if (!profile) return
    setShowFollowers(false)
    setShowFollowing(true)

    const { data: rows } = await supabase
      .from("followers")
      .select("following_id")
      .eq("follower_id", profile.id)

    const ids = [...new Set(rows?.map((r) => r.following_id).filter(Boolean) ?? [])]
    if (ids.length === 0) {
      setFollowingModalUsers([])
      return
    }

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, name")
      .in("id", ids)

    setFollowingModalUsers(profs ?? [])
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
          <div className="mb-10 flex items-start gap-4">
            <img
              src={profile.avatar_url || "/default-avatar.png"}
              alt=""
              onError={(e) => {
                e.currentTarget.src = "/default-avatar.png"
              }}
              className="w-16 h-16 shrink-0 rounded-full object-cover"
            />

            <div className="min-w-0 flex-1">
              <div className="flex w-full flex-col">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-semibold leading-tight">
                    {profile.name || "User"}
                  </h1>

                  {currentUserId && currentUserId !== profile.id && (
                    <div className="ml-2 flex gap-2">
                      <button
                        type="button"
                        onClick={handleFollowToggle}
                        disabled={followBusy}
                        className={`rounded px-3 py-1 text-sm text-white disabled:opacity-50 ${
                          isFollowing ? "bg-red-500" : "bg-blue-500"
                        }`}
                      >
                        {isFollowing ? "Unfollow" : "Follow"}
                      </button>

                      <button
                        type="button"
                        onClick={handleMessage}
                        disabled={messageBusy}
                        className="rounded bg-white/10 px-3 py-1 text-sm text-white disabled:opacity-50"
                      >
                        Message
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-400">@{profile.username}</p>

                <div className="mt-1 flex gap-4 text-sm text-gray-400">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={openFollowersModal}
                    onKeyDown={(e) =>
                      e.key === "Enter" && openFollowersModal()
                    }
                    className="cursor-pointer hover:text-white"
                  >
                    {followersCount} Followers
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={openFollowingModal}
                    onKeyDown={(e) =>
                      e.key === "Enter" && openFollowingModal()
                    }
                    className="cursor-pointer hover:text-white"
                  >
                    {followingCount} Following
                  </span>
                </div>
              </div>

              {profile.bio ? (
                <p className="mt-2 max-w-md text-sm text-gray-300">
                  {profile.bio}
                </p>
              ) : (
                <p className="mt-2 max-w-md text-sm italic text-gray-500">
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

      {showFollowers && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={closeFollowModals}
        >
          <div
            className="max-h-[400px] w-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-white">Followers</h2>

            {followersModalUsers.length === 0 ? (
              <p className="text-sm text-gray-400">No followers yet.</p>
            ) : (
              <div className="space-y-1">
                {followersModalUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition hover:bg-white/10"
                    onClick={() => {
                      closeFollowModals()
                      router.push(`/profile/${u.username}`)
                    }}
                  >
                    <img
                      src={u.avatar_url || "/default-avatar.png"}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.src = "/default-avatar.png"
                      }}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <span className="text-white">{u.username}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={closeFollowModals}
              className="mt-4 w-full rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showFollowing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={closeFollowModals}
        >
          <div
            className="max-h-[400px] w-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-white">Following</h2>

            {followingModalUsers.length === 0 ? (
              <p className="text-sm text-gray-400">Not following anyone yet.</p>
            ) : (
              <div className="space-y-1">
                {followingModalUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition hover:bg-white/10"
                    onClick={() => {
                      closeFollowModals()
                      router.push(`/profile/${u.username}`)
                    }}
                  >
                    <img
                      src={u.avatar_url || "/default-avatar.png"}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.src = "/default-avatar.png"
                      }}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <span className="text-white">{u.username}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={closeFollowModals}
              className="mt-4 w-full rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
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