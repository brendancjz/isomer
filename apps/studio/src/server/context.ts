import type * as trpc from "@trpc/server"
import type { CreateNextContextOptions } from "@trpc/server/adapters/next"
import { GrowthBook } from "@growthbook/growthbook"
import { type User } from "@prisma/client"
import { getIronSession } from "iron-session"
import { env } from "~/env.mjs"
import { IS_SINGPASS_ENABLED_FEATURE_KEY } from "~/lib/growthbook"
import { type Session, type SessionData } from "~/lib/types/session"

import { generateSessionOptions } from "./modules/auth/session"
import { db } from "./modules/database"
import { type defaultUserSelect } from "./modules/me/me.select"
import { prisma } from "./prisma"

interface CreateContextOptions {
  session?: Session
  user?: Pick<User, (typeof defaultUserSelect)[number]>
}

/**
 * Inner function for `createContext` where we create the context.
 * This is useful for testing when we don't want to mock Next.js' request/response
 */
export function createContextInner(opts: CreateContextOptions) {
  return {
    session: opts.session,
    prisma,
    db,
  }
}

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/context
 */
export const createContext = async (opts: CreateNextContextOptions) => {
  const session = await getIronSession<SessionData>(
    opts.req,
    opts.res,
    generateSessionOptions({ ttlInHours: 1 }), // Note: this wouldn't overwrite the cookie (e.g. TTL) if it already exists
  )

  const innerContext = createContextInner({
    session,
  })

  return {
    ...innerContext,
    req: opts.req,
    res: opts.res,
    gb: await createGrowthBookContext(),
  }
}

export const createGrowthBookContext = async () => {
  const clientKey = env.GROWTHBOOK_CLIENT_KEY?.trim() ?? ""
  const hasClientKey = clientKey.length > 0

  const growthbookContext = new GrowthBook({
    apiHost: "https://cdn.growthbook.io",
    ...(hasClientKey ? { clientKey } : {}),
    debug: false, // NOTE: do not put true unless local dev
    disableCache: true,
    // Disable Singpass locally so the email OTP flow completes without needing
    // a running Singpass OIDC server.
    ...(env.NODE_ENV === "development" && {
      forcedFeatureValues: {
        [IS_SINGPASS_ENABLED_FEATURE_KEY]: false,
      },
    }),
  })

  // init() without a payload calls _refresh(), which throws if clientKey is missing.
  // Mirror client _app.tsx: allow local dev when GROWTHBOOK_CLIENT_KEY is unset.
  if (hasClientKey) {
    await growthbookContext.init({ timeout: 2000 })
  } else {
    await growthbookContext.init({ payload: { features: {} } })
  }

  return growthbookContext
}

export type Context = trpc.inferAsyncReturnType<typeof createContext>
