import type { Logger } from '../../../logger'
import type { FileSystem } from '../../../storage/FileSystem'
import type { default as Indy, BlobReaderHandle } from 'indy-sdk'

import axios from 'axios'
import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { getDirFromFilePath } from '../../../utils/path'
import { AriesFrameworkError, IndySdkError } from 'packages/core/src/error'
import { isIndyError } from 'packages/core/src/utils/indyError'

@scoped(Lifecycle.ContainerScoped)
export class IndyUtilitiesService {
  private indy: typeof Indy
  private logger: Logger
  private fileSystem: FileSystem

  public constructor(agentConfig: AgentConfig) {
    this.indy = agentConfig.agentDependencies.indy
    this.logger = agentConfig.logger
    this.fileSystem = agentConfig.fileSystem
  }

  /**
   * Get a handler for the blob storage tails file reader.
   *
   * @param tailsFilePath The path of the tails file
   * @returns The blob storage reader handle
   */
  public async createTailsReader(tailsFilePath: string): Promise<BlobReaderHandle> {
    try {
      this.logger.debug(`Opening tails reader at path ${tailsFilePath}`)
      const tailsFileExists = await this.fileSystem.exists(tailsFilePath)

      // Extract directory from path (should also work with windows paths)
      const dirname = getDirFromFilePath(tailsFilePath)

      if (!tailsFileExists) {
        throw new AriesFrameworkError(`Tails file does not exist at path ${tailsFilePath}`)
      }

      const tailsReaderConfig = {
        base_dir: dirname,
      }

      const tailsReader = await this.indy.openBlobStorageReader('default', tailsReaderConfig)
      this.logger.debug(`Opened tails reader at path ${tailsFilePath}`)
      return tailsReader
    } catch (error) {
      if (isIndyError(error)) {
        throw new IndySdkError(error)
      }

      throw error
    }
  }

  public async downloadTails(hash: string, tailsLocation: string): Promise<BlobReaderHandle> {
    try {
      this.logger.debug(`Checking to see if tails file for URL ${tailsLocation} has been stored in the FileSystem`)
      const filePath = `${this.fileSystem.basePath}/afj/tails/${hash}`

      const tailsExists = await this.fileSystem.exists(filePath)
      this.logger.debug(`Tails file for ${tailsLocation} ${tailsExists ? 'is stored' : 'is not stored'} at ${filePath}`)
      if (!tailsExists) {
        this.logger.debug(`Retrieving tails file from URL ${tailsLocation}`)

        const response = await axios.get(tailsLocation, {
          responseType: 'arraybuffer',
          timeout: 15000,
        })

        if (response.data) {
          this.logger.debug(`Retrieved tails file from URL ${tailsLocation}, writing to FileSystem at path ${filePath}`)
          await this.fileSystem.write(filePath, Buffer.from(response.data).toString())
          this.logger.debug(`Saved tails file to FileSystem at path ${filePath}`)
        } else {
          throw new Error('Fetched empty tails file data, unable to save tails file')
        }
      }

      this.logger.debug(`Tails file for URL ${tailsLocation} is stored in the FileSystem, opening tails reader`)
      return this.createTailsReader(filePath)
    } catch (error) {
      this.logger.error(`Error while retrieving tails file from URL ${tailsLocation}`, {
        error,
        errorMessage: error.message,
      })
      throw error
    }
  }
}
