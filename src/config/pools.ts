export interface PoolInfo {
    poolId: string
    icon: string
    name?: string
    baseAPY : number
    pystats : string
  }
  
  // 示例池子列表
  export const POOLS: PoolInfo[] = [
    // {
    //   poolId: "0x6e99fac5be26b9fb93d50ab1f9d696c87f40458a8cba70896d36cf4761dbf213",
    //   icon: "https://assets.panora.exchange/tokens/aptos/STHAPT.png",
    //   name: "sthApt",
    //   baseAPY:8.44,
    //   pystats:"0x2dc0346406d08fb0d7a96ac7d99151a4e08a06c0558dd84e2a41101298c13703"
    // },
    {
      poolId: "0x2e4b39bfe5204d953abd5f892a38902af0c034e347f4676e57ea4946cd55d8f0",
      icon: "https://assets.panora.exchange/tokens/aptos/STHAPT.png",
      name: "sthApt",
      baseAPY:8.44,
      pystats:"0x2dc0346406d08fb0d7a96ac7d99151a4e08a06c0558dd84e2a41101298c13703"
    },
    {
      poolId: "0x4a26a18b8983bdb7f5801403351ce109a330e0328ecb6f09d27b3ea817ff6c08",
      icon: "https://assets.panora.exchange/tokens/aptos/sUSDe.png",
      name: "sUSDe",
      baseAPY:6,
      pystats:"0x5113c5bb39638c7350a211a7da4cc0c06f6206b319dcc90fd3de8574f9cf0821"
    },
    {
      poolId: "0xc0230261747c1dad17f5c9204d664543f5366643f7d7a70eb72341b6aec29bb8",
      icon: "https://assets.panora.exchange/tokens/aptos/TruAPT.png",
      name: "truApt",
      baseAPY:6.73,
      pystats:"0xb208dd728116c30021cce57da93b97b760727d4e6ea52fe32d01f9b776a12dda"
    },
  ]