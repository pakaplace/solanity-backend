import React, { useContext } from 'react';

const SocketContext = React.createContext<any>(null);

const useSocket = () => {
  const context = useContext(SocketContext);
  return context;
};

export { SocketContext, useSocket };
