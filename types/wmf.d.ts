declare module "wmf" {
  interface WmfModule {
    get_actions(buffer: Buffer | Uint8Array): unknown[]
    image_size(buffer: Buffer | Uint8Array): [number, number]
  }
  const wmf: WmfModule
  export default wmf
}
