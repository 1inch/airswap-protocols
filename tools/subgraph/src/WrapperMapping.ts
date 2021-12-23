import {
  OwnershipTransferred as OwnershipTransferredEvent,
  WrappedSwapFor as WrappedSwapForEvent
} from "../generated/Wrapper/Wrapper"
import { OwnershipTransferred, WrappedSwapFor } from "../generated/schema"

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner
  entity.save()
}

export function handleWrappedSwapFor(event: WrappedSwapForEvent): void {
  let completedSwapFor = new WrappedSwapFor(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  completedSwapFor.senderWallet = event.params.senderWallet
  completedSwapFor.save()
}
