export const InjectionSymbols = {
  Wallet: Symbol('Wallet'),
  Indy: Symbol('Indy'),
  MessageRepository: Symbol('MessageRepository'),
  StorageService: Symbol('StorageService'),
  Logger: Symbol('Logger'),
  FileSystem: Symbol('FileSystem'),
  InboundTransporter: Symbol('InboundTransporter'),
  OutboundTransporter: Symbol('OutboundTransporter'),
}

export const DID_COMM_TRANSPORT_QUEUE = 'didcomm:transport/queue'
