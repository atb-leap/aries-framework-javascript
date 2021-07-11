import type { InboundTransporter, Agent, OutboundPackage } from '../../src'
import type { TransportSession } from '../../src/agent/TransportService'
import type { Express, Request, Response } from 'express'

import { AriesFrameworkError } from '../../src'
import logger from '../../src/__tests__/logger'
import { TransportService } from '../../src/agent/TransportService'
import { uuid } from '../../src/utils/uuid'

export class HttpInboundTransporter implements InboundTransporter {
  private app: Express

  public constructor(app: Express) {
    this.app = app
  }

  public async start(agent: Agent) {
    const transportService = agent.injectionContainer.resolve(TransportService)

    this.app.post('/msg', async (req, res) => {
      const session = new HttpTransportSession(uuid(), req, res)
      try {
        const message = req.body
        const packedMessage = JSON.parse(message)
        await agent.receiveMessage(packedMessage, session)

        // If agent did not use session when processing message we need to send response here.
        if (!res.headersSent) {
          res.status(200).end()
        }
      } catch (error) {
        logger.error(`Error processing message in mediator: ${error.message}`, error)
        res.status(500).send('Error processing message')
      } finally {
        transportService.removeSession(session)
      }
    })
  }

  public async stop(): Promise<void> {
    // TODO: stop server (need server to do that)
  }
}

export class HttpTransportSession implements TransportSession {
  public id: string
  public readonly type = 'http'
  public req: Request
  public res: Response

  public constructor(id: string, req: Request, res: Response) {
    this.id = id
    this.req = req
    this.res = res
  }

  public async send(outboundMessage: OutboundPackage): Promise<void> {
    logger.debug(`Sending outbound message via ${this.type} transport session`)

    if (this.res.headersSent) {
      throw new AriesFrameworkError(`${this.type} transport session has been closed.`)
    }

    this.res.status(200).json(outboundMessage.payload).end()
  }
}
