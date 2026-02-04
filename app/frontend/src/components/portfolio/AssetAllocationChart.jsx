/**
 * 자산 배분 차트 컴포넌트
 * 포트폴리오 내 종목별 비중을 파이 차트로 표시
 */
import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import axios from 'axios';
import toast from 'react-hot-toast';

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
];

export default function AssetAllocationChart({ portfolioId }) {
  const [allocation, setAllocation] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (portfolioId) {
      loadAllocation();
    }
  }, [portfolioId]);

  const loadAllocation = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/user-portfolio/portfolios/${portfolioId}/allocation`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAllocation(response.data.allocation);
    } catch (error) {
      toast.error('자산 배분 정보를 불러오지 못했습니다');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">자산 배분</h3>
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!allocation || allocation.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">자산 배분</h3>
        <div className="flex items-center justify-center h-80 text-gray-500">
          보유 종목이 없습니다
        </div>
      </div>
    );
  }

  const chartData = allocation.map((item) => ({
    name: item.ticker_cd,
    value: item.weight_pct,
    marketValue: item.market_value
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            비중: <span className="font-semibold">{data.value.toFixed(2)}%</span>
          </p>
          <p className="text-sm text-gray-600">
            가치: <span className="font-semibold">${data.marketValue.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">자산 배분</h3>

      {/* Pie Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name} ${value.toFixed(1)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            isAnimationActive={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      {/* Holdings List */}
      <div className="mt-6 space-y-3">
        {allocation.map((item, index) => (
          <div
            key={item.ticker_cd}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              ></div>
              <div>
                <p className="font-semibold text-gray-900">{item.ticker_cd}</p>
                <p className="text-xs text-gray-500">
                  {item.quantity.toFixed(2)} shares @ ${item.current_price?.toFixed(2) || item.avg_cost.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                ${item.market_value.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                {item.weight_pct.toFixed(2)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
