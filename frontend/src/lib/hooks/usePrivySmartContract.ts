import { usePrivy, useWallets, useFundWallet } from '@privy-io/react-auth'
import { useState } from 'react'
import { encodeFunctionData, type Abi } from 'viem'
import type { WalletWithMetadata } from '@privy-io/react-auth'

interface WriteContractArgs {
  address: `0x${string}`
  abi: Abi
  functionName: string
  args?: any[]
}

export function usePrivySmartContract() {
  const { user } = usePrivy()
  const { wallets } = useWallets()
  const { fundWallet } = useFundWallet()
  const [isPending, setIsPending] = useState(false)

  const getPrivyWallet = async (): Promise<WalletWithMetadata | null> => {
    // Get the embedded wallet (Privy wallet)
    const embeddedWallet = wallets.find(
      wallet => wallet.walletClientType === 'privy'
    )
    
    if (!embeddedWallet) {
      // Try to get any connected wallet
      const anyWallet = wallets[0]
      if (!anyWallet) {
        console.error('No wallet found. Please create a wallet first.')
        return null
      }
      return anyWallet
    }
    
    return embeddedWallet
  }

  const checkBalance = async (wallet: WalletWithMetadata, requiredAmount: bigint): Promise<boolean> => {
    try {
      const provider = await wallet.getEthereumProvider()
      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [wallet.address, 'latest'],
      })
      
      const balanceBigInt = BigInt(balance)
      console.log('Wallet balance:', balanceBigInt.toString(), 'Required:', requiredAmount.toString())
      return balanceBigInt >= requiredAmount
    } catch (error) {
      console.error('Error checking balance:', error)
      return false
    }
  }

  const promptFundingIfNeeded = async (wallet: WalletWithMetadata, error: any): Promise<void> => {
    // Check if error is related to insufficient funds
    const errorMessage = error?.message || error?.toString() || ''
    const isInsufficientFunds = errorMessage.toLowerCase().includes('insufficient') || 
                               errorMessage.toLowerCase().includes('funds') ||
                               errorMessage.toLowerCase().includes('balance')
    
    if (isInsufficientFunds && wallet.walletClientType === 'privy') {
      console.log('Insufficient funds detected, triggering funding flow for:', wallet.address)
      
      try {
        // Fund on Base (cheaper than mainnet) - use simple configuration
        await fundWallet(wallet.address)
      } catch (fundingError) {
        console.error('Funding flow failed:', fundingError)
      }
    }
  }

  const writeContract = async (config: WriteContractArgs) => {
    setIsPending(true)
    try {
      const wallet = await getPrivyWallet()
      if (!wallet) {
        throw new Error('No wallet available. Please create a wallet in the Privy debug panel.')
      }

      // Switch to the correct chain if needed (local chain)
      await wallet.switchChain(31337)

      // Get the ethereum provider from the wallet
      const provider = await wallet.getEthereumProvider()
      
      // Encode the function call
      const data = encodeFunctionData({
        abi: config.abi,
        functionName: config.functionName,
        args: config.args || [],
      })

      // First, estimate gas for the transaction
      const estimatedGas = await provider.request({
        method: 'eth_estimateGas',
        params: [{
          from: wallet.address as `0x${string}`,
          to: config.address,
          data,
        }],
      })

      console.log('Estimated gas:', estimatedGas)

      // Get current gas price
      const gasPrice = await provider.request({
        method: 'eth_gasPrice',
        params: [],
      })

      // Calculate total required ETH (gas * gasPrice)
      const gasCost = BigInt(estimatedGas) * BigInt(gasPrice)
      
      // Check if wallet has sufficient balance BEFORE attempting transaction
      const hasSufficientFunds = await checkBalance(wallet, gasCost)
      
      if (!hasSufficientFunds) {
        console.log('Insufficient funds for transaction, prompting funding...')
        
        // Check current chain
        const chainId = await provider.request({ method: 'eth_chainId' })
        const currentChainId = parseInt(chainId, 16)
        
        if (currentChainId === 31337) {
          // For local development, explain the situation
          const shouldFund = confirm(
            'You need ETH on the local development chain (31337) to play this game.\n\n' +
            'Privy funding works on mainnet/testnet but you\'re on local development.\n\n' +
            'Options:\n' +
            '• Click OK to fund on Base network (you\'ll need to bridge)\n' +
            '• Click Cancel and ask developer for test ETH\n\n' +
            'Proceed with funding on Base?'
          )
          
          if (shouldFund) {
            await promptFundingIfNeeded(wallet, new Error('Insufficient funds for gas'))
            alert('✅ Funded on Base network. For local development, you may need the developer to provide test ETH directly on localhost:31337')
          }
        } else {
          await promptFundingIfNeeded(wallet, new Error('Insufficient funds for gas'))
        }
        
        throw new Error('Insufficient funds for transaction. Please fund your wallet and try again.')
      }

      // Create and send the transaction with gas parameters
      const txRequest = {
        from: wallet.address as `0x${string}`,
        to: config.address,
        data,
        gas: estimatedGas, // Use estimated gas
        gasPrice: gasPrice, // Use current gas price
        value: '0x0', // No ETH value for contract calls
      }

      console.log('Sending transaction with Privy wallet:', txRequest)
      
      // Send the transaction using the Privy wallet's provider
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txRequest],
      })

      console.log('Transaction sent successfully:', txHash)
      return txHash
    } catch (error) {
      console.error('Error sending transaction with Privy:', error)
      
      // If transaction fails due to insufficient funds, prompt for funding
      const wallet = await getPrivyWallet()
      if (wallet) {
        await promptFundingIfNeeded(wallet, error)
      }
      
      throw error
    } finally {
      setIsPending(false)
    }
  }

  return {
    writeContract,
    isPending,
    wallets,
  }
}