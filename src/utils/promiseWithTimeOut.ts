import { EventEmitter } from 'events'
import { ConnectionInvitationMessage, ConnectionState } from '..'
import { KeylistState, KeylistUpdateMessage, MediationState, RequestMediationMessage } from '../modules/routing'

// contributed from simongregory gist at https://gist.github.com/simongregory/2c60d270006d4bf727babca53dca1f87
export async function waitForEventWithTimeout(
  emitter: EventEmitter,
  eventType: ConnectionState | MediationState | KeylistState,
  message: ConnectionInvitationMessage | RequestMediationMessage | KeylistUpdateMessage,
  timeout: number
) {
  return new Promise((resolve, reject) => {

    function listener(data: any) {
      //TODO: check if thread Id matches the on in the message
      clearTimeout(timer)
      emitter.removeListener(eventType, listener)
      resolve(data)
    }

    emitter.on(eventType, listener)
    const timer: NodeJS.Timeout = setTimeout(() => {
      emitter.removeListener(eventType, listener)
      reject(new Error('timeout waiting for ' + eventType + 'from initialized from message' + message))
    }, timeout)
  })
}

// Example usage
//const promise = waitForEventWithTimeout(session, 'message', 2000);
