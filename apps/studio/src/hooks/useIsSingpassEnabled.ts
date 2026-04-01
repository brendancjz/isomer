import { useFeatureValue } from "@growthbook/growthbook-react"
import {
  IS_SINGPASS_ENABLED_FEATURE_KEY,
  IS_SINGPASS_ENABLED_FEATURE_KEY_FALLBACK_VALUE,
} from "~/lib/growthbook"

export const useIsSingpassEnabled = () => {
  const featureValue = useFeatureValue<boolean>(
    IS_SINGPASS_ENABLED_FEATURE_KEY,
    IS_SINGPASS_ENABLED_FEATURE_KEY_FALLBACK_VALUE,
  )
  // No Singpass OIDC server runs locally — always skip the Singpass step in dev
  if (process.env.NODE_ENV === "development") return false
  return featureValue
}
