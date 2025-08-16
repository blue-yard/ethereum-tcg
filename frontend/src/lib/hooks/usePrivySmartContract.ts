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
    console.log('Available wallets:', wallets.map(w => ({ address: w.address, type: w.walletClientType })))
    
    // Always prioritize the Privy embedded wallet for consistency
    const embeddedWallet = wallets.find(
      wallet => wallet.walletClientType === 'privy'
    )
    
    if (embeddedWallet) {
      console.log('Using Privy embedded wallet:', { address: embeddedWallet.address, type: embeddedWallet.walletClientType })
      return embeddedWallet
    }
    
    // If no embedded wallet exists, this is an error for our use case
    console.error('No Privy embedded wallet found. Available wallets:', wallets.map(w => ({ address: w.address, type: w.walletClientType })))
    throw new Error('No Privy embedded wallet found. Please ensure you have a Privy wallet created.')
  }

  const checkBalance = async (wallet: WalletWithMetadata, requiredAmount: bigint): Promise<boolean> => {
    try {
      const provider = await wallet.getEthereumProvider()
      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [wallet.address, 'latest'],
      })
      
      const balanceBigInt = BigInt(balance)
      console.log('Checking balance for wallet:', wallet.address)
      console.log('Wallet balance:', balanceBigInt.toString(), 'Required:', requiredAmount.toString())
      console.log('Has sufficient funds:', balanceBigInt >= requiredAmount)
      return balanceBigInt >= requiredAmount
    } catch (error) {
      console.error('Error checking balance for wallet:', wallet.address, error)
      return false
    }
  }

  const localFundWallet = async (wallet: WalletWithMetadata, amount: bigint): Promise<void> => {
    try {
      console.log('Attempting local funding for:', wallet.address, 'Amount:', amount.toString())
      
      // For local development, create a direct RPC call to localhost:8545
      const response = await fetch('http://localhost:8545', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendTransaction',
          params: [{
            from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Default Anvil account
            to: wallet.address,
            value: `0x${amount.toString(16)}`, // Convert bigint to hex
            gas: '0x5208', // 21000 gas for simple transfer
          }]
        })
      })
      
      const result = await response.json()
      
      if (result.error) {
        throw new Error(`RPC Error: ${result.error.message}`)
      }
      
      console.log('Local funding transaction sent:', result.result)
      
      // Wait a moment for the transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 1500))
      
    } catch (error) {
      console.error('Local funding failed:', error)
      throw error
    }
  }

  const promptFundingIfNeeded = async (wallet: WalletWithMetadata, error: any): Promise<void> => {
    // Check if error is related to insufficient funds
    const errorMessage = error?.message || error?.toString() || ''
    const isInsufficientFunds = errorMessage.toLowerCase().includes('insufficient') || 
                               errorMessage.toLowerCase().includes('funds') ||
                               errorMessage.toLowerCase().includes('balance')
    
    console.log('Checking if funding needed:', {
      isInsufficientFunds,
      walletType: wallet.walletClientType,
      walletAddress: wallet.address,
      errorMessage
    })
    
    if (isInsufficientFunds && wallet.walletClientType === 'privy') {
      console.log('Insufficient funds detected for Privy wallet, triggering funding flow for:', wallet.address)
      
      try {
        console.log('Calling fundWallet for:', wallet.address)
        
        // Fund the exact wallet we're using for transactions
        await fundWallet(wallet.address)
        console.log('Funding flow completed successfully for:', wallet.address)
      } catch (fundingError) {
        console.error('Funding flow failed for wallet:', wallet.address, fundingError)
        
        // If funding fails, show a helpful message
        if (fundingError.message?.includes('not supported') || fundingError.message?.includes('Insufficient balance')) {
          alert(
            `Funding issue detected:\n\n` +
            `• Wallet address: ${wallet.address}\n` +
            `• Chain: Local development (31337)\n` +
            `• Privy funding works on mainnet/testnets, not local development\n\n` +
            `For local development, you need test ETH from the developer.`
          )
        } else {
          // Show the actual funding error
          alert(`Funding failed: ${fundingError.message || fundingError}`)
        }
      }
    } else if (isInsufficientFunds && wallet.walletClientType !== 'privy') {
      console.log('Insufficient funds detected for non-Privy wallet:', wallet.walletClientType)
      alert(
        `Insufficient funds detected:\n\n` +
        `• Wallet: ${wallet.address}\n` +
        `• Type: ${wallet.walletClientType}\n` +
        `• Funding is only available for Privy embedded wallets\n\n` +
        `Please add ETH to your wallet manually or switch to a Privy wallet.`
      )
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
          // For local development, try local funding first
          console.log('Local development detected - attempting local funding')
          try {
            await localFundWallet(wallet, gasCost * 2n) // Fund with 2x the required amount
            // After local funding, check balance again
            const newBalance = await checkBalance(wallet, gasCost)
            if (newBalance) {
              console.log('Local funding successful, proceeding with transaction')
              return // Continue with the transaction
            }
          } catch (localFundError) {
            console.log('Local funding failed, falling back to Privy funding modal:', localFundError)
            await promptFundingIfNeeded(wallet, new Error('Insufficient funds for gas'))
          }
        } else {
          // For production chains, proceed directly with funding
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