import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Company {
  id: string;
  name: string;
}

interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  constraints?: string[];
}

interface EnhancedContext {
  relevanceScore: number;
  suggestedAnalogyPoints: string[];
  detectedAlgorithms: string[];
  detectedDataStructures: string[];
}

interface EnhancedProblemTransformerProps {
  problems: Problem[];
  companies: Company[];
}

const EnhancedProblemTransformer: React.FC<EnhancedProblemTransformerProps> = ({ problems, companies }) => {
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string>('');
  const [enhancedContext, setEnhancedContext] = useState<EnhancedContext | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Update selected problem when problem ID changes
  useEffect(() => {
    if (selectedProblemId) {
      const problem = problems.find(p => p.id === selectedProblemId) || null;
      setSelectedProblem(problem);
    } else {
      setSelectedProblem(null);
    }
  }, [selectedProblemId, problems]);

  // Update selected company when company ID changes
  useEffect(() => {
    if (selectedCompanyId) {
      const company = companies.find(c => c.id === selectedCompanyId) || null;
      setSelectedCompany(company);
    } else {
      setSelectedCompany(null);
    }
  }, [selectedCompanyId, companies]);

  const handleProblemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProblemId(e.target.value);
    setScenario('');
    setEnhancedContext(null);
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCompanyId(e.target.value);
    setScenario('');
    setEnhancedContext(null);
  };

  const transformProblem = async () => {
    if (!selectedProblemId || !selectedCompanyId) {
      setError('Please select both a problem and a company');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post('/api/enhance-transform-problem', {
        problemId: selectedProblemId,
        companyId: selectedCompanyId,
        useCache: true
      });

      setScenario(response.data.scenario);
      setEnhancedContext(response.data.enhancedContext);
    } catch (error) {
      console.error('Error transforming problem with enhanced context:', error);
      setError('Failed to transform problem. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Enhanced Problem Transformer</h2>
      
      <div className="space-y-4 mb-6">
        {/* Problem Selection */}
        <div>
          <label htmlFor="problem-select" className="block text-sm font-medium mb-1">
            Select Problem
          </label>
          <select
            id="problem-select"
            value={selectedProblemId}
            onChange={handleProblemChange}
            className="w-full p-2 border rounded"
            disabled={loading}
          >
            <option value="">Select a problem</option>
            {problems.map(problem => (
              <option key={problem.id} value={problem.id}>
                {problem.title} ({problem.difficulty})
              </option>
            ))}
          </select>
        </div>

        {/* Company Selection */}
        <div>
          <label htmlFor="company-select" className="block text-sm font-medium mb-1">
            Select Company
          </label>
          <select
            id="company-select"
            value={selectedCompanyId}
            onChange={handleCompanyChange}
            className="w-full p-2 border rounded"
            disabled={loading}
          >
            <option value="">Select a company</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        <button
          onClick={transformProblem}
          disabled={!selectedProblemId || !selectedCompanyId || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-300"
        >
          {loading ? 'Transforming...' : 'Transform with Enhanced Context'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Original Problem */}
      {selectedProblem && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium mb-2">Original Problem</h3>
          <div className="mb-1 font-semibold">{selectedProblem.title} ({selectedProblem.difficulty})</div>
          <p className="whitespace-pre-wrap">{selectedProblem.description}</p>
        </div>
      )}

      {/* Enhanced Context */}
      {enhancedContext && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-medium mb-2">Enhanced Context</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-semibold mb-1">Relevance Score</div>
              <div className="mb-3">{enhancedContext.relevanceScore}/10</div>
              
              <div className="font-semibold mb-1">Detected Algorithms</div>
              <ul className="list-disc list-inside mb-3">
                {enhancedContext.detectedAlgorithms.length > 0 ? (
                  enhancedContext.detectedAlgorithms.map((algo, idx) => (
                    <li key={idx}>{algo}</li>
                  ))
                ) : (
                  <li className="text-gray-500">None detected</li>
                )}
              </ul>
            </div>
            
            <div>
              <div className="font-semibold mb-1">Detected Data Structures</div>
              <ul className="list-disc list-inside mb-3">
                {enhancedContext.detectedDataStructures.length > 0 ? (
                  enhancedContext.detectedDataStructures.map((ds, idx) => (
                    <li key={idx}>{ds}</li>
                  ))
                ) : (
                  <li className="text-gray-500">None detected</li>
                )}
              </ul>
              
              <div className="font-semibold mb-1">Suggested Analogies</div>
              <ul className="list-disc list-inside">
                {enhancedContext.suggestedAnalogyPoints.length > 0 ? (
                  enhancedContext.suggestedAnalogyPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))
                ) : (
                  <li className="text-gray-500">None suggested</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Transformed Scenario */}
      {scenario && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">
            {selectedCompany?.name} Interview Scenario
          </h3>
          <div className="p-4 bg-green-50 rounded whitespace-pre-wrap border border-green-200">
            {scenario}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedProblemTransformer; 