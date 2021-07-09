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
  tags?: CustomMediationTags
}

export type CustomMediationTags = {
  default?: boolean
}

export type DefaultMediationTags = {
  role: MediationRole
  connectionId: string
  state: MediationState
}

export class MediationRecord
  extends BaseRecord<DefaultMediationTags, CustomMediationTags>
  implements MediationRecordProps
{
  public state!: MediationState
  public role!: MediationRole
  public connectionId!: string
  public endpoint?: string
  public recipientKeys!: Verkey[]
  public routingKeys!: Verkey[]

  public static readonly type = 'MediationRecord'
  public readonly type = MediationRecord.type

  public constructor(props: MediationRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.connectionId = props.connectionId
      this.recipientKeys = props.recipientKeys || []
      this.routingKeys = props.routingKeys || []
      this.state = props.state || MediationState.Init
      this.role = props.role
      this.endpoint = props.endpoint ?? undefined
    }
  }

  public getTags(): { state: MediationState; role: MediationRole; connectionId: string } {
    return {
      ...this._tags,
      state: this.state,
      role: this.role,
      connectionId: this.connectionId,
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
}
