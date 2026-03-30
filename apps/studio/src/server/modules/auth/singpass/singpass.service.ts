import { generators, Issuer } from "openid-client"

import { env } from "~/env.mjs"
import {
  SINGPASS_ENCRYPTION_JWK,
  SINGPASS_REDIRECT_URI,
  SINGPASS_SCOPES,
  SINGPASS_SIGNING_JWK,
} from "./singpass.constants"
import { extractUuid } from "./singpass.utils"

// Lazily initialised so that the module can be imported without a running
// Singpass OIDC server (e.g. in local development with Singpass disabled).
let _singpassClient: InstanceType<(typeof Issuer)["prototype"]["Client"]> | null =
  null

const getSingpassClient = async () => {
  if (!_singpassClient) {
    const singpassIssuer = await Issuer.discover(env.SINGPASS_ISSUER_ENDPOINT)
    _singpassClient = new singpassIssuer.Client(
      {
        client_id: env.SINGPASS_CLIENT_ID,
        response_types: ["code"],
        token_endpoint_auth_method: "private_key_jwt",
        id_token_signed_response_alg: "ES256",
      },
      {
        keys: [SINGPASS_SIGNING_JWK, SINGPASS_ENCRYPTION_JWK],
      },
    )
  }
  return _singpassClient
}

export const getAuthorizationUrl = async () => {
  const singpassClient = await getSingpassClient()
  const codeVerifier = generators.codeVerifier()
  const codeChallenge = generators.codeChallenge(codeVerifier)
  const nonce = generators.nonce()
  const state = generators.state()

  const authorizationUrl = singpassClient.authorizationUrl({
    redirect_uri: SINGPASS_REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    nonce,
    state,
    scope: SINGPASS_SCOPES.join(" "),
  })
  const session = {
    codeVerifier,
    nonce,
  }

  return { authorizationUrl, session }
}

interface LoginParams {
  code: string
  codeVerifier: string
  nonce: string
  state: string
}

export const login = async ({
  code,
  codeVerifier,
  nonce,
  state,
}: LoginParams) => {
  try {
    const singpassClient = await getSingpassClient()
    const stringifiedState = JSON.stringify(state)
    const tokens = await singpassClient.callback(
      SINGPASS_REDIRECT_URI,
      {
        code,
        state: stringifiedState,
      },
      {
        state: stringifiedState,
        code_verifier: codeVerifier,
        nonce,
      },
    )
    const uuid = extractUuid(tokens)
    return { uuid }
  } catch (e) {
    console.trace(e)
    throw e
  }
}
