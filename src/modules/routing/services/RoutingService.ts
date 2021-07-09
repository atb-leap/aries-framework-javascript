/*----------------------------------------------------------
| Routing service is the common code used in mediation scenarios 
|*/

import type { MediationRecordProps } from '../repository/MediationRecord'
import type { MediationRepository } from '../repository/MediationRepository'

import { MediationRecord } from '../repository/MediationRecord'

export async function createRecord(
  { state, role, connectionId, recipientKeys }: MediationRecordProps,
  mediatorRepository: MediationRepository
): Promise<MediationRecord> {
  const mediationRecord = new MediationRecord({
    state,
    role,
    connectionId,
    recipientKeys,
    tags: {
      role,
      connectionId,
    },
  })
  await mediatorRepository.save(mediationRecord)
  return mediationRecord
}
