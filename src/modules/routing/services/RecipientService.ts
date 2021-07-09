import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../connections'
import type { MediationStateChangedEvent, KeylistUpdatedEvent } from '../RoutingEvents'
import type { MediationGrantMessage, MediationDenyMessage, KeylistUpdateResponseMessage } from '../messages'
import type { Verkey } from 'indy-sdk'

import { filter, first, timeout } from 'rxjs/operators'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { createOutboundMessage } from '../../../agent/helpers'
import { InjectionSymbols } from '../../../constants'
import { Wallet } from '../../../wallet/Wallet'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { RoutingEventTypes } from '../RoutingEvents'
import { KeylistUpdateAction, MediationRequestMessage } from '../messages'
import { KeylistMessage } from '../messages/KeylistMessage'
import { KeylistUpdate, KeylistUpdateMessage } from '../messages/KeylistUpdatedMessage'
import { MediationRole, MediationState } from '../models'
import { MediationRecord } from '../repository/MediationRecord'
import { MediationRepository } from '../repository/MediationRepository'

@scoped(Lifecycle.ContainerScoped)
export class RecipientService {
  private wallet: Wallet
  private mediatorRepository: MediationRepository
  private defaultMediator?: MediationRecord
  private eventEmitter: EventEmitter
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private config: AgentConfig

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    config: AgentConfig,
    mediatorRepository: MediationRepository,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.wallet = wallet
    this.mediatorRepository = mediatorRepository
    this.eventEmitter = eventEmitter
    this.connectionService = connectionService
    this.messageSender = messageSender
  }

  public async init() {
    const records = await this.mediatorRepository.getAll()
    for (const record of records) {
      if (record.default) {
        // Remove any possible competing mediators set all other record tags' default to false.
        this.setDefaultMediator(record)
        return this.defaultMediator
      }
    }
  }

  public async createRequest(connection: ConnectionRecord): Promise<[MediationRecord, MediationRequestMessage]> {
    const mediationRecord = new MediationRecord({
      state: MediationState.Requested,
      role: MediationRole.Mediator,
      connectionId: connection.id,
      tags: {
        role: MediationRole.Mediator,
        connectionId: connection.id,
      },
    })
    await this.mediatorRepository.save(mediationRecord)
    return [mediationRecord, new MediationRequestMessage({})]
  }

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    // Mediation record must already exists to be updated to granted status
    const mediationRecord = await this.findByConnectionId(connection.id)
    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }
    // Assert
    mediationRecord.assertState(MediationState.Requested)

    // Update record
    mediationRecord.endpoint = messageContext.message.endpoint
    mediationRecord.routingKeys = messageContext.message.routingKeys
    return await this.updateState(mediationRecord, MediationState.Granted)
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public createKeylistQuery(
    filter?: Map<string, string>,
    paginateLimit?: number | undefined,
    paginateOffset?: number | undefined
  ) {
    //paginateLimit = paginateLimit ?? -1,
    //paginateOffset = paginateOffset ?? 0
    // TODO: Implement this
    return new KeylistMessage({})
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  public async processKeylistUpdateResults(messageContext: InboundMessageContext<KeylistUpdateResponseMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = await this.findByConnectionId(connection.id)
    if (!mediationRecord) {
      throw new Error(`mediation record for  ${connection.id} not found!`)
    }
    const keylist = messageContext.message.updated

    // update keylist in mediationRecord
    for (const update of keylist) {
      if (update.action === KeylistUpdateAction.add) {
        await this.saveRoute(update.recipientKey, mediationRecord)
      } else if (update.action === KeylistUpdateAction.remove) {
        await this.removeRoute(update.recipientKey, mediationRecord)
      }
    }
    this.eventEmitter.emit<KeylistUpdatedEvent>({
      type: RoutingEventTypes.RecipientKeylistUpdated,
      payload: {
        mediationRecord,
        keylist,
      },
    })
  }

  public async keylistUpdateAndAwait(
    mediationRecord: MediationRecord,
    verKey: string,
    timeoutMs = 15000 // TODO: this should be a configurable value in agent config
  ): Promise<MediationRecord> {
    const message = this.createKeylistUpdateMessage(verKey)
    const connection = await this.connectionService.getById(mediationRecord.connectionId)

    // Create observable for event
    const observable = this.eventEmitter.observable<KeylistUpdatedEvent>(RoutingEventTypes.RecipientKeylistUpdated)

    // Apply required filters to observable stream and create promise to subscribe to observable
    const keylistUpdatePromise = observable
      .pipe(
        // Only take event for current mediation record
        filter((event) => mediationRecord.id === event.payload.mediationRecord.id),
        // Only wait for first event that matches the criteria
        first(),
        // Do not wait for longer than specified timeout
        timeout(timeoutMs)
      )
      .toPromise()
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    // Await the observable promise
    const keylistUpdate = await keylistUpdatePromise
    return keylistUpdate.payload.mediationRecord
  }

  public createKeylistUpdateMessage(verkey: Verkey): KeylistUpdateMessage {
    const keylistUpdateMessage = new KeylistUpdateMessage({
      updates: [
        new KeylistUpdate({
          action: KeylistUpdateAction.add,
          recipientKey: verkey,
        }),
      ],
    })
    return keylistUpdateMessage
  }

  public async getRouting(mediationRecord: MediationRecord | undefined, routingKeys: string[], myEndpoint?: string) {
    let endpoint
    if (mediationRecord) {
      routingKeys = [...routingKeys, ...mediationRecord.routingKeys]
      endpoint = mediationRecord.endpoint
    }
    // Create and store new key
    const [did, verkey] = await this.wallet.createDid()
    if (mediationRecord) {
      // new did has been created and mediator needs to be updated with the public key.
      mediationRecord = await this.keylistUpdateAndAwait(mediationRecord, did)
    } else {
      // TODO: register recipient keys for relay
      // TODO: check that recipient keys are in wallet
    }
    endpoint = endpoint ?? myEndpoint ?? this.config.getEndpoint()
    const result = { mediationRecord, endpoint, routingKeys, did, verkey }
    return result
  }

  public async saveRoute(recipientKey: Verkey, mediationRecord: MediationRecord) {
    mediationRecord.recipientKeys.push(recipientKey)
    this.mediatorRepository.update(mediationRecord)
  }

  public async removeRoute(recipientKey: Verkey, mediationRecord: MediationRecord) {
    const index = mediationRecord.recipientKeys.indexOf(recipientKey, 0)
    if (index > -1) {
      mediationRecord.recipientKeys.splice(index, 1)
    }
    this.mediatorRepository.update(mediationRecord)
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessage>) {
    const connection = messageContext.assertReadyConnection()

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(connection.id)

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }

    // Assert
    mediationRecord.assertState(MediationState.Requested)

    // Update record
    await this.updateState(mediationRecord, MediationState.Denied)

    return mediationRecord
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param MediationRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  private async updateState(mediationRecord: MediationRecord, newState: MediationState) {
    const previousState = mediationRecord.state
    mediationRecord.state = newState
    await this.mediatorRepository.update(mediationRecord)

    this.eventEmitter.emit<MediationStateChangedEvent>({
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord,
        previousState,
      },
    })
    return mediationRecord
  }

  public async findById(id: string): Promise<MediationRecord | null> {
    try {
      const record = await this.mediatorRepository.findById(id)
      return record
    } catch (error) {
      return null
    }
    // TODO - Handle errors?
  }

  public async findByConnectionId(connectionId: string): Promise<MediationRecord | null> {
    try {
      const records = await this.mediatorRepository.findByQuery({ connectionId })
      return records[0]
    } catch (error) {
      return null
    }
  }

  public async getMediators(): Promise<MediationRecord[] | null> {
    return await this.mediatorRepository.getAll()
  }

  public async getDefaultMediatorId(): Promise<string | undefined> {
    if (this.defaultMediator) {
      return this.defaultMediator.id
    }
    const record = await this.getDefaultMediator()
    return record ? record.id : undefined
  }

  public async getDefaultMediator() {
    if (!this.defaultMediator) {
      const records = (await this.mediatorRepository.getAll()) ?? []
      for (const record of records) {
        if (record.default) {
          this.setDefaultMediator(record)
          return this.defaultMediator
        }
      }
    }
    return this.defaultMediator
  }

  public async discoverMediation(mediatorId?: string): Promise<MediationRecord | undefined> {
    if (mediatorId) {
      const mediationRecord = await this.findById(mediatorId)
      if (mediationRecord) {
        return mediationRecord
      }
    }

    const defaultMediator = await this.getDefaultMediator()
    if (defaultMediator) {
      if (defaultMediator.state !== MediationState.Granted) {
        throw new Error(`Mediation State for ${defaultMediator.id} is not granted, but is set as default mediator!`)
      }
      return defaultMediator
    }
  }

  public async setDefaultMediator(mediator: MediationRecord) {
    // Get list of all mediator records. For each record, update default all others to false.
    const fetchedRecords = (await this.getMediators()) ?? []

    for (const record of fetchedRecords) {
      record.default = false
      await this.mediatorRepository.update(record)
    }
    // Set record coming in tag to true and then update.
    mediator.default = true
    await this.mediatorRepository.update(mediator)
    this.defaultMediator = mediator
    return this.defaultMediator
  }

  public async clearDefaultMediator() {
    const fetchedRecords = (await this.getMediators()) ?? []
    for (const record of fetchedRecords) {
      record.default = false
      await this.mediatorRepository.update(record)
    }
    delete this.defaultMediator
  }
}
