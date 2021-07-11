import type { OutboundTransporter } from '../transport/OutboundTransporter'
import type { OutboundMessage, OutboundPackage } from '../types'
import type { EnvelopeKeys } from './EnvelopeService'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { MessageRepository } from '../storage/MessageRepository'

import { EnvelopeService } from './EnvelopeService'
import { TransportService } from './TransportService'

@scoped(Lifecycle.ContainerScoped)
export class MessageSender {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageRepository: MessageRepository
  private logger: Logger
  private _outboundTransporter?: OutboundTransporter

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageRepository = messageRepository
    this.logger = logger
  }

  public setOutboundTransporter(outboundTransporter: OutboundTransporter) {
    this._outboundTransporter = outboundTransporter
  }

  public get outboundTransporter() {
    return this._outboundTransporter
  }

  public async packMessage(outboundMessage: OutboundMessage, keys: EnvelopeKeys): Promise<OutboundPackage> {
    const { connection, payload } = outboundMessage
    const wireMessage = await this.envelopeService.packMessage(payload, keys)
    return { connection, payload: wireMessage }
  }

  public async sendMessage(outboundMessage: OutboundMessage) {
    if (!this.outboundTransporter) {
      throw new AriesFrameworkError('Agent has no outbound transporter!')
    }

    const { connection, payload } = outboundMessage
    const { id, verkey, theirKey } = connection
    const message = payload.toJSON()
    this.logger.debug('Send outbound message', {
      messageId: message.id,
      connection: { id, verkey, theirKey },
    })

    // Try sending over already open connection
    const session = this.transportService.findSessionByConnectionId(connection.id)
    if (session?.inboundMessage?.hasReturnRouting(outboundMessage.payload.threadId)) {
      this.logger.debug(`Existing ${session.type} transport session has been found.`)
      try {
        if (!session.keys) {
          throw new AriesFrameworkError(`There are no keys for the given ${session.type} transport session.`)
        }
        const outboundPackage = await this.packMessage(outboundMessage, session.keys)
        await session.send(outboundPackage)
        return
      } catch (error) {
        this.logger.info(`Sending an outbound message via session failed with error: ${error.message}.`, error)
      }
    }

    // Set return routing for message if we don't have an inbound endpoint for this connection
    if (!this.transportService.hasInboundEndpoint(outboundMessage.connection.didDoc)) {
      outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)
    }

    const services = this.transportService.findDidCommServices(connection)
    if (services.length === 0) {
      throw new AriesFrameworkError(`Connection with id ${connection.id} has no service!`)
    }

    for await (const service of services) {
      // We can't send message to didcomm:transport/queue
      if (service.serviceEndpoint === DID_COMM_TRANSPORT_QUEUE) {
        continue
      }

      this.logger.debug(`Preparing outbound message to service:`, { messageId: message.id, service })
      try {
        const keys = {
          recipientKeys: service.recipientKeys,
          routingKeys: service.routingKeys || [],
          senderKey: connection.verkey,
        }
        const outboundPackage = await this.packMessage(outboundMessage, keys)
        outboundPackage.endpoint = service.serviceEndpoint
        outboundPackage.responseRequested = outboundMessage.payload.hasReturnRouting()
        await this.outboundTransporter.sendMessage(outboundPackage)

        return
      } catch (error) {
        this.logger.debug(
          `Preparing outbound message to service with id ${service.id} failed with the following error:`,
          {
            message: error.message,
            error: error,
          }
        )
      }
    }

    // We didn't succeed to send the message over open session, or directly to serviceEndpoint
    // If the other party shared a queue service endpoint in their did doc we queue the message
    const { theirDidDoc } = outboundMessage.connection
    if (theirDidDoc && this.transportService.hasInboundEndpoint(theirDidDoc)) {
      // FIXME: this currently adds unpacked message to queue. It expects packed message
      this.messageRepository.add(outboundMessage.connection.id, outboundMessage.payload)
    }
  }
}
