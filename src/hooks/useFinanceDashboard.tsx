import { useEffect, useState } from 'react';
import api from '@/services/api';

export const useFinanceDashboard = (projectId?: string) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      void projectId;
      const res: any = await api.getFinanceStats('month');
      setData(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return { data, loading, error, reload: load };
};

export default useFinanceDashboard;
