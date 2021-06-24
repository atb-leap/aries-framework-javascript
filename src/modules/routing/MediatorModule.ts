import type { WireMessage } from '../../types'
import type { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import type { MediationRecord } from './index'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'

import { KeylistUpdateHandler, ForwardHandler, BatchPickupHandler, BatchHandler } from './handlers'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'
import { MediatorService } from './services/MediatorService'
import { MessagePickupService } from './services/MessagePickupService'

@scoped(Lifecycle.ContainerScoped)
export class MediatorModule {
  private mediatorService: MediatorService
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  public eventEmitter: EventEmitter

  public constructor(
    dispatcher: Dispatcher,
    mediationService: MediatorService,
    messagePickupService: MessagePickupService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.mediatorService = mediationService
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
  }
  /* eslint-disable @typescript-eslint/no-unused-vars */
  public async init(config: { autoAcceptMediationRequests: boolean }) {
    // autoAcceptMediationRequests
    //             "automatically granting to everyone asking, rather than enabling the feature altogether"
    //             "After establishing a connection, "
    //             "if enabled, an agent may request message mediation, which will "
    //             "allow the mediator to forward messages on behalf of the recipient. "
    //             "See aries-rfc:0211."
    //if (config.autoAcceptMediationRequests) {
    //  this.autoAcceptMediationRequests = config.autoAcceptMediationRequests
    //}
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  public async grantRequestedMediation(connectionRecord: ConnectionRecord, mediationRecord: MediationRecord) {
    const grantMessage = await this.mediatorService.createGrantMediationMessage(mediationRecord)
    const outboundMessage = createOutboundMessage(connectionRecord, grantMessage)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  public queueMessage(theirKey: string, message: WireMessage) {
    return this.messagePickupService.queueMessage(theirKey, message)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.mediatorService))
    dispatcher.registerHandler(new ForwardHandler(this.mediatorService))
    dispatcher.registerHandler(new BatchPickupHandler(this.messagePickupService))
    dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
    dispatcher.registerHandler(new MediationRequestHandler(this.mediatorService))
  }
}
