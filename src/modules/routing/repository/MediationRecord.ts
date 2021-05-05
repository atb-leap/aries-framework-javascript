import type { Verkey } from 'indy-sdk'
import { v4 as uuid } from 'uuid'
import { BaseRecord, Tags } from '../../../storage/BaseRecord'
import { MediationRole, MediationState } from '..'

export interface MediationRecordProps {
  id?: string
  state: MediationState
  role: MediationRole
  createdAt?: Date
  connectionId: string
  endpoint?: string
  recipientKeys?: Verkey[]
  routingKeys?: Verkey[]
}

export interface MediationTags extends Tags {
  state: MediationState
  role: MediationRole
  connectionId: string
}

export interface MediationStorageProps extends MediationRecordProps {
  tags: MediationTags
}

export class MediationRecord extends BaseRecord implements MediationStorageProps {
  public state: MediationState
  public role: MediationRole
  public tags: MediationTags
  public connectionId: string
  public endpoint: string
  public recipientKeys: Verkey[]
  public routingKeys: Verkey[]

  public static readonly = "MediationRecord"
  public readonly type = MediationRecord.type

  public constructor(props: MediationStorageProps) {
    super()
    this.id = props.id ?? uuid()
    this.createdAt = new Date()
    this.connectionId = props.connectionId
    this.recipientKeys = props.recipientKeys || []
    this.routingKeys = props.routingKeys || []
    this.tags = props.tags || {}
    this.state = props.state || MediationState.Init
    this.role = props.role
    this.connectionId = props.connectionId
    this.endpoint = props.endpoint || ''
  }

  public assertState(expectedStates: MediationState | MediationState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new Error(
        `Mediation record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertRole(expectedRole: MediationRole) {
    if (this.role !== expectedRole) {
      throw new Error(`Mediation record has invalid role ${this.role}. Expected role ${expectedRole}.`)
    }
  }

  public assertConnection(currentConnectionId: string) {
    if (this.connectionId !== currentConnectionId) {
      throw new Error(
        `Proof record is associated with connection '${this.connectionId}'. Current connection is '${currentConnectionId}'`
      )
    }
  }
}
