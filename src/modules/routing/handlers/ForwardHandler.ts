import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { ConnectionService } from '../../connections/services'
import type { MediatorService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { ForwardMessage } from '../messages'

export class ForwardHandler implements Handler {
  private mediatorService: MediatorService
  private connectionService: ConnectionService
  private messageSender: MessageSender

  public supportedMessages = [ForwardMessage]

  public constructor(
    mediatorService: MediatorService,
    connectionService: ConnectionService,
    messageSender: MessageSender
  ) {
    this.mediatorService = mediatorService
    this.connectionService = connectionService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<ForwardHandler>) {
    const { packedMessage, mediationRecord } = await this.mediatorService.processForwardMessage(messageContext)

    const connectionRecord = await this.connectionService.getById(mediationRecord.connectionId)

    // FIXME: the message inside the forward message is packed, which the current API does not support
    // We've been re-sending the received forward message until now, but this is incorrect.
    // createOutboundMessage / sendMessage should be able to handle a WireMessage / JsonWebKey
    const outbound = createOutboundMessage(connectionRecord, messageContext.message)
    await this.messageSender.sendMessage(outbound)
  }
}
