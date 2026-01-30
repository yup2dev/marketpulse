/**
 * Fed Policy Gauge - Data-driven monetary policy analysis
 */
import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Minus, RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';

const STANCE_CONFIG = {
  hawkish: {
    name: 'Hawkish',
    color: '#ef4444',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500',
    textColor: 'text-red-400',
    description: 'Tightening policy, higher rates likely'
  },
  neutral: {
    name: 'Neutral',
    color: '#f59e0b',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-400',
    description: 'Balanced approach, rates stable'
  },
  dovish: {
    name: 'Dovish',
    color: '#10b981',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500',
    textColor: 'text-green-400',
    description: 'Accommodative policy, lower rates likely'
  }
};

export default function FedPolicyGauge() {
  const [policyData, setPolicyData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolicyData();
  }, []);

  const fetchPolicyData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/macro/fed-policy/stance`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setPolicyData(data);
    } catch (error) {
      console.error('Error fetching Fed policy data:', error);
      setPolicyData(null);
    } finally {
      setLoading(false);
    }
  };

  const config = policyData ? STANCE_CONFIG[policyData.stance] : null;
  const gaugePosition = policyData ? ((policyData.stance_score + 100) / 200) * 100 : 50;

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[#0d0d12] rounded-lg p-6 border border-gray-800 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!policyData || !config) {
    return (
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-12 text-center">
        <p className="text-gray-400">Unable to load Fed policy data</p>
        <button onClick={fetchPolicyData} className="mt-4 text-cyan-400 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Stance */}
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Current Fed Policy Stance</h3>
          <button onClick={fetchPolicyData} className="text-gray-400 hover:text-white">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stance Card */}
            <div className={`p-4 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
              <div className={`text-3xl font-bold ${config.textColor} mb-2`}>{config.name}</div>
              <p className="text-gray-400 text-sm">{config.description}</p>
              <div className="mt-4 text-sm text-gray-500">
                Score: <span className="text-white font-medium">{policyData.stance_score}</span>
              </div>
            </div>

            {/* Gauge */}
            <div className="md:col-span-2">
              <div className="mb-4">
                <div className="relative w-full h-8 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to right, #10b981 0%, #f59e0b 50%, #ef4444 100%)' }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white"
                    style={{ left: `${gaugePosition}%`, transform: 'translateX(-50%)', boxShadow: '0 0 10px rgba(255,255,255,0.8)' }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>Dovish (-100)</span>
                  <span>Neutral (0)</span>
                  <span>Hawkish (+100)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fed Funds Rate */}
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Fed Funds Rate</h3>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="px-4 py-3 font-medium">Metric</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-white">Effective Rate</td>
                  <td className="px-4 py-3 text-right text-white font-medium text-xl">
                    {policyData.fed_funds_rate}%
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-white">Target Range</td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    {policyData.fed_funds_target_range?.lower}% - {policyData.fed_funds_target_range?.upper}%
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-white">Rate Changes (12M)</td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    {policyData.historical_context?.rate_changes_12m}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FOMC Meeting Probabilities */}
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Next FOMC Meeting Probabilities</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Hike */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <ArrowUp size={16} className="text-red-400" />
                <span className="text-white">Rate Hike (+25bp)</span>
              </div>
              <span className="text-white font-bold">{policyData.next_meeting?.probabilities?.hike}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{ width: `${policyData.next_meeting?.probabilities?.hike}%` }}
              />
            </div>
          </div>

          {/* Hold */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Minus size={16} className="text-amber-400" />
                <span className="text-white">Hold (No Change)</span>
              </div>
              <span className="text-white font-bold">{policyData.next_meeting?.probabilities?.hold}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full"
                style={{ width: `${policyData.next_meeting?.probabilities?.hold}%` }}
              />
            </div>
          </div>

          {/* Cut */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <ArrowDown size={16} className="text-green-400" />
                <span className="text-white">Rate Cut (-25bp)</span>
              </div>
              <span className="text-white font-bold">{policyData.next_meeting?.probabilities?.cut}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${policyData.next_meeting?.probabilities?.cut}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Historical Context */}
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Historical Context</h3>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="px-4 py-3 font-medium">Metric</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-white">Peak Rate</td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    {policyData.historical_context?.peak_rate}%
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">Historical maximum</td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-white">Trough Rate</td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    {policyData.historical_context?.trough_rate}%
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">Historical minimum</td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-white">Current Percentile</td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    {policyData.historical_context?.percentile}%
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">Position in historical range</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      {policyData.last_updated && (
        <div className="text-center text-xs text-gray-500">
          Last updated: {new Date(policyData.last_updated).toLocaleString()}
        </div>
      )}
    </div>
  );
}
