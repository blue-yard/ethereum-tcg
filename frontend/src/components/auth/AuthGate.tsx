import { usePrivy, useLogin, useFundWallet } from '@privy-io/react-auth'
import type { ReactNode } from 'react'
import { LoadingScreen } from '@/components/ui/LoadingSpinner'
import { FadeInUp, ScaleIn } from '@/components/ui/PageTransition'

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { ready, authenticated, user } = usePrivy()
  const { fundWallet } = useFundWallet()
  
  const { login } = useLogin({
    onComplete: ({ user, isNewUser, wasAlreadyAuthenticated }) => {
      console.log('Login completed:', { user, isNewUser, wasAlreadyAuthenticated, wallet: user.wallet })
      console.log('Wallet client type:', user.wallet?.walletClientType)
      
      // Automatically prompt new users to fund their embedded wallet for gas fees
      if (isNewUser && user.wallet?.walletClientType === 'privy') {
        console.log('Triggering funding for new Privy user:', user.wallet.address)
        fundWallet(user.wallet.address).catch(error => {
          console.error('Funding failed:', error)
        })
      } else {
        console.log('Funding not triggered:', { isNewUser, walletClientType: user.wallet?.walletClientType })
      }
    }
  })
  

  if (!ready) {
    return <LoadingScreen message="Initializing Web3..." />
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-eth-dark flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <FadeInUp className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Token Tycoon
            </h1>
            <p className="text-gray-400">
              The ultimate blockchain trading card game
            </p>
          </FadeInUp>
          
          <ScaleIn delay={0.2}>
            <div className="card p-8">
              <h2 className="text-2xl font-semibold text-white mb-6 text-center">
                Connect to Play
              </h2>
              
              <button
                onClick={login}
                className="btn-primary w-full py-3 text-lg font-medium hover:scale-105 transition-transform"
              >
                Connect Wallet
              </button>
              
              <p className="text-sm text-gray-400 text-center mt-4">
                Connect your wallet to start playing and collecting NFT cards
              </p>
            </div>
          </ScaleIn>
        </div>
      </div>
    )
  }

  return <>{children}</>
}