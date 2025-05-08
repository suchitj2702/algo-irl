import { useState } from 'react';
import axios from 'axios';

interface Company {
  id: string;
  name: string;
}

interface Problem {
  title: string;
  description: string;
  difficulty: string;
  constraints?: string[];
}

interface ProblemTransformerProps {
  problem: Problem;
  companies: Company[];
}

const ProblemTransformer: React.FC<ProblemTransformerProps> = ({ problem, companies }) => {
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [scenario, setScenario] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCompany(e.target.value);
  };

  const transformProblem = async () => {
    if (!selectedCompany) {
      setError('Please select a company');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post('/api/transform-problem', {
        problem,
        company: selectedCompany,
        useCache: true
      });

      setScenario(response.data.scenario);
    } catch (error) {
      console.error('Error transforming problem:', error);
      setError('Failed to transform problem. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Transform Problem for Company Context</h2>
      
      <div className="mb-4">
        <label htmlFor="company-select" className="block text-sm font-medium mb-1">
          Select Company
        </label>
        <select
          id="company-select"
          value={selectedCompany}
          onChange={handleCompanyChange}
          className="w-full p-2 border rounded"
          disabled={loading}
        >
          <option value="">Select a company</option>
          {companies.map(company => (
            <option key={company.id} value={company.name}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={transformProblem}
        disabled={!selectedCompany || loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-300"
      >
        {loading ? 'Transforming...' : 'Transform Problem'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {scenario && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">{selectedCompany} Interview Scenario</h3>
          <div className="p-4 bg-gray-50 rounded whitespace-pre-wrap">
            {scenario}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProblemTransformer; 