import type { Verkey } from 'indy-sdk'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { Dispatcher } from '../../agent/Dispatcher'
import { ConnectionService, TrustPingService } from './services'
import { ConnectionRecord } from './repository/ConnectionRecord'
import { ConnectionInvitationMessage } from './messages'
import {
  ConnectionRequestHandler,
  ConnectionResponseHandler,
  AckMessageHandler,
  TrustPingMessageHandler,
  TrustPingResponseMessageHandler,
} from './handlers'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { EventEmitter } from '../../agent/EventEmitter'
import { KeylistUpdateEvent, RoutingEventTypes } from '../routing/RoutingEvents'
import { DID_COMM_TRANSPORT_QUEUE } from '../../agent/TransportService'

@scoped(Lifecycle.ContainerScoped)
export class ConnectionsModule {
  private agentConfig: AgentConfig
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private trustPingService: TrustPingService
  private eventEmitter: EventEmitter

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    trustPingService: TrustPingService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.trustPingService = trustPingService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter

    this.registerHandlers(dispatcher)
  }

  public async createConnection(config?: {
    autoAcceptConnection?: boolean
    alias?: string
    mediatorId?: string
  }): Promise<{
    invitation: ConnectionInvitationMessage
    connectionRecord: ConnectionRecord
  }> {
    const { connectionRecord: connectionRecord, message: invitation } = await this.connectionService.createInvitation({
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
      mediatorId: config?.mediatorId,
    })

    return { connectionRecord, invitation }
  }

  /**
   * Receive connection invitation as invitee and create connection. If auto accepting is enabled
   * via either the config passed in the function or the global agent config, a connection
   * request message will be send.
   *
   * @param invitationJson json object containing the invitation to receive
   * @param config config for handling of invitation
   * @returns new connection record
   */
  public async receiveInvitation(
    invitation: ConnectionInvitationMessage,
    config?: {
      autoAcceptConnection?: boolean
      alias?: string
      mediatorId?: string
    }
  ): Promise<ConnectionRecord> {
    let connection = await this.connectionService.processInvitation(invitation, {
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
      mediatorId: config?.mediatorId,
    })

    if (!config?.mediatorId && this.agentConfig.getEndpoint() == DID_COMM_TRANSPORT_QUEUE) {
      const { message: connectionRequest, connectionRecord: connectionRecord } =
        await this.connectionService.createRequest(connection.id)

      const outboundMessage = createOutboundMessage(connectionRecord, connectionRequest, connectionRecord.invitation)
      outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)

      await this.messageSender.sendMessage(outboundMessage)
      await this.connectionService.returnWhenIsConnected(connectionRecord.id)
      console.log("PUKE: filename: /src/modules/connections/ConnectionsModule.ts, line: 97"); //PKDBG/Point;
    } else {
      // if auto accept is enabled (either on the record or the global agent config)
      // we directly send a connection request
      if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
        connection = await this.acceptInvitation(connection.id)
      }
    }

    return connection
  }

  /**
   * Receive connection invitation as invitee encoded as url and create connection. If auto accepting is enabled
   * via either the config passed in the function or the global agent config, a connection
   * request message will be send.
   *
   * @param invitationUrl url containing a base64 encoded invitation to receive
   * @param config config for handling of invitation
   * @returns new connection record
   */
  public async receiveInvitationFromUrl(
    invitationUrl: string,
    config?: {
      autoAcceptConnection?: boolean
      alias?: string
      mediatorId?: string
    }
  ): Promise<ConnectionRecord> {
    const invitation = await ConnectionInvitationMessage.fromUrl(invitationUrl)
    return this.receiveInvitation(invitation, config)
  }

  /**
   * Accept a connection invitation as invitee (by sending a connection request message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connections is enabled.
   *
   * @param connectionId the id of the connection for which to accept the invitation
   * @returns connection record
   */
  public async acceptInvitation(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createRequest(connectionId)

    const outbound = createOutboundMessage(connectionRecord, message, connectionRecord.invitation)
    await this.messageSender.sendMessage(outbound)

    return connectionRecord
  }

  /**
   * Accept a connection request as inviter (by sending a connection response message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the request
   * @returns connection record
   */
  public async acceptRequest(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createResponse(connectionId)

    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)

    return connectionRecord
  }

  /**
   * Accept a connection response as invitee (by sending a trust ping message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the response
   * @returns connection record
   */
  public async acceptResponse(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createTrustPing(connectionId)

    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)

    return connectionRecord
  }

  public async returnWhenIsConnected(connectionId: string): Promise<ConnectionRecord> {
    return this.connectionService.returnWhenIsConnected(connectionId)
  }

  /**
   * Retrieve all connections records
   *
   * @returns List containing all connection records
   */
  public getAll() {
    return this.connectionService.getAll()
  }

  /**
   * Retrieve a connection record by id
   *
   * @param connectionId The connection record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The connection record
   *
   */
  public getById(connectionId: string): Promise<ConnectionRecord> {
    return this.connectionService.getById(connectionId)
  }

  /**
   * Find a connection record by id
   *
   * @param connectionId the connection record id
   * @returns The connection record or null if not found
   */
  public findById(connectionId: string): Promise<ConnectionRecord | null> {
    return this.connectionService.findById(connectionId)
  }

  /**
   * Find connection by verkey.
   *
   * @param verkey the verkey to search for
   * @returns the connection record, or null if not found
   * @throws {RecordDuplicateError} if multiple connections are found for the given verkey
   */
  public findByVerkey(verkey: Verkey): Promise<ConnectionRecord | null> {
    return this.connectionService.findByVerkey(verkey)
  }

  /**
   * Find connection by their verkey.
   *
   * @param verkey the verkey to search for
   * @returns the connection record, or null if not found
   * @throws {RecordDuplicateError} if multiple connections are found for the given verkey
   */
  public findByTheirKey(verkey: Verkey): Promise<ConnectionRecord | null> {
    return this.connectionService.findByTheirKey(verkey)
  }

  /**
   * Retrieve a connection record by thread id
   *
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The connection record
   */
  public getByThreadId(threadId: string): Promise<ConnectionRecord> {
    return this.connectionService.getByThreadId(threadId)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new ConnectionRequestHandler(this.connectionService, this.agentConfig))
    dispatcher.registerHandler(new ConnectionResponseHandler(this.connectionService, this.agentConfig))
    dispatcher.registerHandler(new AckMessageHandler(this.connectionService))
    dispatcher.registerHandler(new TrustPingMessageHandler(this.trustPingService, this.connectionService))
    dispatcher.registerHandler(new TrustPingResponseMessageHandler(this.trustPingService))
  }
}
