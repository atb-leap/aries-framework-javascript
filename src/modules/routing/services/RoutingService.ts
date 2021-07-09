/*----------------------------------------------------------
| Routing service is the common code used in mediation senarios 
|*/
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { BaseEvent } from '../../../agent/Events'
import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'

import { AriesFrameworkError } from '../../../error/AriesFrameworkError'

/**
 * waitForEvent
 * eventProducer
 *    callable function():void{}
 * eventEmitter
 *    EventEmitter
 *    Emitter that will emit the event
 * eventName
 *    String
 *    the name of the event that will be emitted
 * filter
 *    callable function(event):boolean{}
 *    optional function returning whether or not the event satisfies conditions
 **/
/* eslint-disable */
export const waitForEvent = async (
  eventProducer: CallableFunction,
  eventName: string,
  condition: CallableFunction,
  timeout = 10000,
  eventEmitter: EventEmitter
): Promise<BaseEvent> => {
  // Capture an event and retrieve its value
  let complete = false
  return new Promise<BaseEvent>(async (resolve, reject) => {
    setTimeout(() => {
      if (!complete) {
        cleanup()
        reject(new Error(`Timed out waiting for event: ${eventName}`))
      }
    }, timeout)

    const cleanup = () => {
      eventEmitter.off(eventName, handler)
      return true
    }

    const handler = async (event: BaseEvent) => {
      try {
        if ((await condition(event)) ?? true) {
          cleanup()
          complete = true
          resolve(event)
        }
      } catch (e) {
        cleanup()
        reject(e)
      }
    }
    try {
      eventEmitter.on(eventName, handler)
      await eventProducer()
    } catch (e) {
      cleanup()
      reject(e)
    }
  }).then((event) => {
    return event
  })
}
/* eslint-enable */

export function assertConnection(
  record: ConnectionRecord | undefined,
  errormsg = 'inbound connection is required'
): ConnectionRecord {
  if (!record) throw new AriesFrameworkError(errormsg)
  record.assertReady()
  return record
}
