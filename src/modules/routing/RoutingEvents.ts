import type { Verkey } from 'indy-sdk'
import { MediationGrantMessage, KeylistUpdateMessage, KeylistUpdated, KeylistUpdateResponseMessage } from './index'

import { BaseEvent } from '../../agent/Events'
import { ConnectionRecord } from '../connections'
import { ForwardMessage } from './messages'
import { MediationState } from './models/MediationState'
import { MediationRecord } from './repository/MediationRecord'
// TODO: clean up event names and structures
export enum RoutingEventTypes {
  MediationStateChanged = 'MediationStateChanged',
  MediationGranted = 'MediationGranted',
  MediationKeylist = 'MediationKeylist',
  RecipientKeylistUpdate = 'RecipientKeylistUpdate',
  MediationKeylistUpdate = 'MediationKeylistUpdate',
  RecipientKeylistUpdated = 'RecipientKeylistUpdated',
  MediationKeylistUpdated = 'MediationKeylistUpdated',
  Forward = 'Forward',
}

export interface MediationGrantedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationGranted
  payload: {
    mediationRecord: MediationRecord
    message: MediationGrantMessage
  }
}

export interface MediationStateChangedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationStateChanged
  payload: {
    mediationRecord: MediationRecord
    previousState: MediationState
  }
}

export interface MediationKeylistEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationKeylist
  payload: {
    mediationRecord: MediationRecord
    keylist: KeylistUpdated[]
  }
}

export interface KeylistUpdateEvent extends BaseEvent {
  type: typeof RoutingEventTypes.RecipientKeylistUpdate
  payload: {
    mediationRecord: MediationRecord
    message: KeylistUpdateMessage
  }
}

export interface KeylistUpdatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.RecipientKeylistUpdated
  payload: {
    mediationRecord: MediationRecord
    keylist: KeylistUpdated[]
  }
}

export interface MediationKeylistUpdatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationKeylistUpdated
  payload: {
    mediationRecord: MediationRecord
    message: KeylistUpdateResponseMessage
    keylist: KeylistUpdated[]
  }
}

export interface ForwardEvent extends BaseEvent {
  type: typeof RoutingEventTypes.Forward
  payload: {
    connectionId: string
    message: ForwardMessage
  }
}
