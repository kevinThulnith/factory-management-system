from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework import viewsets, status
from rest_framework import generics
from .serializers import (
    ManufacturingProcessSerializer,
    ProductionScheduleSerializer,
    LaborAllocationSerializer,
    ProductionLineSerializer,
    ProductProcessSerializer,
    OrderMaterialSerializer,
    SkillMatrixSerializer,
    DepartmentSerializer,
    WorkshopSerializer,
    SupplierSerializer,
    MaterialSerializer,
    MachineSerializer,
    ProductSerializer,
    ProjectSerializer,
    OrderSerializer,
    TaskSerializer,
)
from .models import (
    ManufacturingProcess,
    ProductionSchedule,
    LaborAllocation,
    ProductionLine,
    ProductProcess,
    OrderMaterial,
    SkillMatrix,
    Department,
    Workshop,
    Supplier,
    Material,
    Product,
    Project,
    Machine,
    Order,
    User,
    Task,
)

# TODO: Create department views


class DepartmentCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create workshop views


class WorkshopCreateView(generics.ListCreateAPIView):
    queryset = Workshop.objects.all()
    serializer_class = WorkshopSerializer
    permission_classes = [IsAuthenticated]


class WorkshopDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Workshop.objects.all()
    serializer_class = WorkshopSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create machine views


class MachineCreateView(generics.ListCreateAPIView):
    queryset = Machine.objects.all()
    serializer_class = MachineSerializer
    permission_classes = [IsAuthenticated]


class MachineDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Machine.objects.all()
    serializer_class = MachineSerializer
    permission_classes = [IsAuthenticated]


class MachineViewSet(viewsets.ModelViewSet):
    queryset = Machine.objects.all()
    serializer_class = MachineSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=["post"])
    def assign_operator(self, request, pk=None):
        """Assign an operator to this machine for 12 hours"""
        machine = self.get_object()
        operator_id = request.data.get("operator_id")

        if not operator_id:
            return Response(
                {"error": "operator_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            operator = User.objects.get(id=operator_id)
            machine.assign_operator(operator)
            return Response(MachineSerializer(machine).data, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response(
                {"error": f"User with id {operator_id} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=["post"])
    def clear_operator(self, request, pk=None):
        """Clear the operator assignment for this machine"""
        machine = self.get_object()
        machine.clear_operator()
        return Response(MachineSerializer(machine).data, status=status.HTTP_200_OK)


# TODO: Create supplier views


class SupplierCreateView(generics.ListCreateAPIView):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]


class SupplierDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create material views


class MaterialCreateView(generics.ListCreateAPIView):
    queryset = Material.objects.all()
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]


class MaterialDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Material.objects.all()
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create order views


class OrderCreateView(generics.ListCreateAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class OrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only allow users to update/delete their own orders
        if self.request.method in ["PUT", "PATCH", "DELETE"]:
            return Order.objects.filter(created_by=self.request.user)
        return Order.objects.all()


# TODO: Create order material views


class OrderMaterialCreateView(generics.ListCreateAPIView):
    queryset = OrderMaterial.objects.all()
    serializer_class = OrderMaterialSerializer
    permission_classes = [IsAuthenticated]


class OrderMaterialDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = OrderMaterial.objects.all()
    serializer_class = OrderMaterialSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create production line views


class ProductionLineCreateView(generics.ListCreateAPIView):
    queryset = ProductionLine.objects.all()
    serializer_class = ProductionLineSerializer
    permission_classes = [IsAuthenticated]


class ProductionLineDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ProductionLine.objects.all()
    serializer_class = ProductionLineSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create manufacturing process views


class ManufacturingProcessCreateView(generics.ListCreateAPIView):
    queryset = ManufacturingProcess.objects.all()
    serializer_class = ManufacturingProcessSerializer
    permission_classes = [IsAuthenticated]


class ManufacturingProcessDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ManufacturingProcess.objects.all()
    serializer_class = ManufacturingProcessSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create production schedule views


class ProductionScheduleCreateView(generics.ListCreateAPIView):
    queryset = ProductionSchedule.objects.all()
    serializer_class = ProductionScheduleSerializer
    permission_classes = [IsAuthenticated]


class ProductionScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ProductionSchedule.objects.all()
    serializer_class = ProductionScheduleSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create product views


class ProductCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create product process views


class ProductProcessCreateView(generics.ListCreateAPIView):
    queryset = ProductProcess.objects.all()
    serializer_class = ProductProcessSerializer
    permission_classes = [IsAuthenticated]


class ProductProcessDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ProductProcess.objects.all()
    serializer_class = ProductProcessSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create project views


class ProjectCreateView(generics.ListCreateAPIView):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create task views


class TaskCreateView(generics.ListCreateAPIView):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create labor allocation views


class LaborAllocationCreateView(generics.ListCreateAPIView):
    queryset = LaborAllocation.objects.all()
    serializer_class = LaborAllocationSerializer
    permission_classes = [IsAuthenticated]


class LaborAllocationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = LaborAllocation.objects.all()
    serializer_class = LaborAllocationSerializer
    permission_classes = [IsAuthenticated]


# TODO: Create skill matrix views


class SkillMatrixCreateView(generics.ListCreateAPIView):
    queryset = SkillMatrix.objects.all()
    serializer_class = SkillMatrixSerializer
    permission_classes = [IsAuthenticated]


class SkillMatrixDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SkillMatrix.objects.all()
    serializer_class = SkillMatrixSerializer
    permission_classes = [IsAuthenticated]
