import { NextApiRequest, NextApiResponse } from 'next';
import anthropicService from '../../lib/anthropicService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { problem, company, useCache = true } = req.body;

    // Validate required fields
    if (!problem || !company) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        requiredFields: ['problem', 'company']
      });
    }

    // Validate problem object has required fields
    if (!problem.title || !problem.description || !problem.difficulty) {
      return res.status(400).json({
        error: 'Problem missing required fields',
        requiredFields: ['title', 'description', 'difficulty']
      });
    }

    // Transform the problem into a company-specific scenario
    const scenario = await anthropicService.transformToCompanyScenario({
      problem,
      company,
      useCache
    });

    // Return the transformed scenario
    return res.status(200).json({ scenario });
  } catch (error) {
    console.error('Error transforming problem:', error);
    
    return res.status(500).json({
      error: 'Failed to transform problem',
      message: error instanceof Error ? error.message : String(error)
    });
  }
} 