import type { Agent } from '../agent/Agent'
import type { InboundTransporter } from './InboundTransporter'
import type { Subscription } from 'rxjs'

import { interval } from 'rxjs'

export class DefaultMediatorPollingInboundTransporter implements InboundTransporter {
  private pollingInterval: number
  private subscription?: Subscription

  public constructor(pollingInterval = 5000) {
    this.pollingInterval = pollingInterval
  }

  public async start(agent: Agent) {
    await this.pollDownloadMessages(agent)
  }

  public async stop() {
    this.subscription?.unsubscribe()
  }

  private async pollDownloadMessages(agent: Agent) {
    this.subscription = interval(this.pollingInterval).subscribe(async () => {
      // FIXME: We probably don't want to retrieve the default connection on every interval
      const connection = await agent.mediationRecipient.findDefaultMediatorConnection()

      if (connection?.isReady) {
        await agent.mediationRecipient.downloadMessages(connection)
      }
    })
  }
}
