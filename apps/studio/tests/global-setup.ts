import { stringify } from "superjson"

import type { ContainerInformation } from "./common"
import { CONTAINER_CONFIGURATIONS, setup, teardown } from "./common"

export default async () => {
  const containers = await setup([
    CONTAINER_CONFIGURATIONS.database,
    CONTAINER_CONFIGURATIONS.mockpass,
  ])

  const mockpass = containers.find((c) => c.name === "mockpass")
  if (!mockpass) {
    throw new Error("mockpass container missing from global setup")
  }
  const mockpassHostPort = mockpass.ports.get(5156)
  if (mockpassHostPort === undefined) {
    throw new Error(
      "mockpass container port 5156 was not mapped to a host port",
    )
  }
  process.env.SINGPASS_ISSUER_ENDPOINT = `http://${mockpass.host}:${mockpassHostPort}/singpass/v2`

  Object.defineProperty(process.env, "testcontainers", {
    value: stringify(
      containers.map((container) => {
        const { container: _, ...rest } = container
        const result: ContainerInformation = rest
        return result
      }),
    ),
    configurable: true,
    writable: true,
    enumerable: true,
  })

  return () => teardown(containers)
}
