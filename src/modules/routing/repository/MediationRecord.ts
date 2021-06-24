import type { Tags } from '../../../storage/BaseRecord'
import type { MediationRole } from '../models/MediationRole'
import type { Verkey } from 'indy-sdk'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { MediationState } from '../models/MediationState'

export interface MediationRecordProps {
  id?: string
  state: MediationState
  role: MediationRole
  createdAt?: Date
  connectionId: string
  endpoint?: string
  recipientKeys?: Verkey[]
  routingKeys?: Verkey[]
  default?: boolean
}

export interface MediationTags extends Tags {
  role?: MediationRole
  connectionId?: string
}

export interface MediationStorageProps extends MediationRecordProps {
  tags: MediationTags
}

export class MediationRecord extends BaseRecord implements MediationStorageProps {
  public state!: MediationState
  public role!: MediationRole
  public tags!: MediationTags
  public connectionId!: string
  public endpoint?: string
  public recipientKeys!: Verkey[]
  public routingKeys!: Verkey[]
  public default = false
  public static readonly type = 'MediationRecord'
  public readonly type = MediationRecord.type

  public constructor(props: MediationStorageProps) {
    super()
    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.connectionId = props.connectionId
      this.recipientKeys = props.recipientKeys || []
      this.routingKeys = props.routingKeys || []
      this.tags = props.tags
      this.state = props.state || MediationState.Init
      this.role = props.role
      this.endpoint = props.endpoint ?? undefined
      this.default = props.default || false
    }
  }

  public assertState(expectedStates: MediationState | MediationState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new AriesFrameworkError(
        `Mediation record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertRole(expectedRole: MediationRole) {
    if (this.role !== expectedRole) {
      throw new AriesFrameworkError(`Mediation record has invalid role ${this.role}. Expected role ${expectedRole}.`)
    }
  }

  public assertConnection(currentConnectionId: string) {
    if (this.connectionId !== currentConnectionId) {
      throw new AriesFrameworkError(
        `Proof record is associated with connection '${this.connectionId}'. Current connection is '${currentConnectionId}'`
      )
    }
  }
}
