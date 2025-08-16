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
      
      // Check if we're on local development chain
      const provider = await wallet.getEthereumProvider()
      const chainId = await provider.request({ method: 'eth_chainId' })
      const isLocalChain = parseInt(chainId, 16) === 31337
      
      if (isLocalChain) {
        // For local development, auto-fund the account
        console.log('Local development detected, funding account with Anvil...')
        try {
          const response = await fetch('http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'anvil_setBalance',
              params: [wallet.address, '0x21E19E0C9BAB2400000'], // 10 ETH in wei
              id: 1
            })
          })
          const result = await response.json()
          if (!result.error) {
            console.log('✅ Auto-funded local development account with 10 ETH')
            // Show success message
            alert('✅ Your wallet has been funded with 10 ETH for local development. Please try your transaction again.')
          } else {
            throw new Error('Anvil funding failed: ' + result.error?.message)
          }
        } catch (localFundingError) {
          console.error('Local funding failed:', localFundingError)
          alert('❌ Could not auto-fund local development account. Make sure Anvil is running on localhost:8545')
        }
      } else {
        // For production networks, use Privy funding
        try {
          await fundWallet(wallet.address)
        } catch (fundingError) {
          console.error('Funding flow failed:', fundingError)
          alert('Funding failed. Please try again or contact support.')
        }
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
        await promptFundingIfNeeded(wallet, new Error('Insufficient funds for gas'))
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