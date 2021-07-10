import type { Agent } from '../agent/Agent'
import type { Logger } from '../logger'
import type { OutboundPackage } from '../types'
import type { OutboundTransporter } from './OutboundTransporter'

import { AgentConfig } from '../agent/AgentConfig'
import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error'
import { fetch } from '../utils/fetch'

export class HttpOutboundTransporter implements OutboundTransporter {
  private agent: Agent
  private logger: Logger
  private agentConfig: AgentConfig

  public supportedSchemes = ['http', 'https']

  public constructor(agent: Agent) {
    // TODO: maybe we can let the transport constructed using
    // the dependency injection container. For now just
    // just resolve the dependency from the agent

    this.agent = agent
    this.agentConfig = agent.injectionContainer.resolve(AgentConfig)
    this.logger = agent.injectionContainer.resolve(InjectionSymbols.Logger)
  }

  public async start(): Promise<void> {
    // Nothing required to start HTTP
  }

  public async stop(): Promise<void> {
    // Nothing required to stop HTTP
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, endpoint } = outboundPackage

    if (!endpoint) {
      throw new AriesFrameworkError(`Missing endpoint. I don't know how and where to send the message.`)
    }
    // TODO: use mediation config for queue logic
    // TODO: move this logic to the message sender
    if (endpoint === DID_COMM_TRANSPORT_QUEUE) {
      this.logger.debug('Storing message for queue: ', { connection, payload })
      connection.assertReady()
      if (connection.theirKey) {
        this.agent.mediator.queueMessage(connection.theirKey, payload)
      }
    } else {
      this.logger.debug(
        `Sending outbound message to connection ${outboundPackage.connection.id}`,
        outboundPackage.payload
      )
      try {
        const abortController = new AbortController()
        const id = setTimeout(() => abortController.abort(), 15000)

        const response = await fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': this.agentConfig.didCommMimeType },
          signal: abortController.signal,
        })
        clearTimeout(id)

        const responseMessage = await response.text()

        // TODO: do we just want to ignore messages that were
        // returned if we didn't request it?
        if (responseMessage) {
          this.logger.debug(`Response received:\n ${response}`)
          const wireMessage = JSON.parse(responseMessage)
          this.agent.receiveMessage(wireMessage)
        } else {
          this.logger.debug(`No response received.`)
        }
      } catch (error) {
        this.logger.error(`Error sending message to ${endpoint}: ${error.message}`, {
          error,
          message: error.message,
          body: payload,
          didCommMimeType: this.agentConfig.didCommMimeType,
        })
      }
    }
  }
}
