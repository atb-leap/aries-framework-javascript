import type { Agent } from '../agent/Agent'
import type { ConnectionRecord } from '../modules/connections/repository/ConnectionRecord'
import type { InboundTransporter } from './InboundTransporter'

import { MessageSender } from '../agent/MessageSender'
import { createOutboundMessage } from '../agent/helpers'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { TrustPingMessage } from '../modules/connections/messages/TrustPingMessage'
import { ConnectionState } from '../modules/connections/models/ConnectionState'

export class PollingInboundTransporter implements InboundTransporter {
  public stop: boolean
  private pollingInterval: number

  public constructor(pollingInterval = 5000) {
    this.stop = false
    this.pollingInterval = pollingInterval
  }

  public async start(agent: Agent) {
    await this.pollDownloadMessages(agent)
  }

  private async pollDownloadMessages(agent: Agent) {
    setInterval(async () => {
      if (!this.stop) {
        const connection = await agent.mediationRecipient.findDefaultMediatorConnection()
        if (connection && connection.state == ConnectionState.Complete) {
          await agent.mediationRecipient.downloadMessages(connection)
        }
      }
    }, this.pollingInterval)
  }
}

export class TrustPingPollingInboundTransporter implements InboundTransporter {
  public run: boolean
  private pollingInterval: number
  private messageSender?: MessageSender

  public constructor(pollingInterval = 5000) {
    this.run = false
    this.pollingInterval = pollingInterval
  }

  public async start(agent: Agent) {
    this.messageSender = agent.injectionContainer.resolve(MessageSender)
    this.run = true
    await this.pollDownloadMessages(agent)
  }

  public async stop(): Promise<void> {
    this.run = false
  }

  public async pingMediator(connection: ConnectionRecord) {
    if (this.messageSender) {
      const message = new TrustPingMessage()
      const outboundMessage = createOutboundMessage(connection, message)
      outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)
      await this.messageSender.sendMessage(outboundMessage)
    }
  }

  private async pollDownloadMessages(recipient: Agent) {
    setInterval(async () => {
      if (this.run) {
        const connection = await recipient.mediationRecipient.findDefaultMediatorConnection()
        if (connection && connection.state == 'complete') {
          /*ping mediator uses a trust ping to trigger any stored messages to be sent back, one at a time.*/
          await this.pingMediator(connection)
        }
      }
    }, this.pollingInterval)
  }
}
