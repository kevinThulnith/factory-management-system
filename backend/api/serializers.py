from rest_framework import serializers
from .models import (
    ManufacturingProcess,
    ProductionSchedule,
    LaborAllocation,
    ProductionLine,
    ProductProcess,
    OrderMaterial,
    SkillMatrix,
    Department,
    Supplier,
    Workshop,
    Machine,
    Material,
    Project,
    Product,
    Order,
    Task,
)


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = "__all__"
        extra_kwargs = {"updated_at": {"read_only": True}}


class WorkshopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workshop
        fields = "__all__"
        extra_kwargs = {"updated_at": {"read_only": True}}


class MachineSerializer(serializers.ModelSerializer):
    workshop_name = serializers.StringRelatedField(source="workshop", read_only=True)
    operator_name = serializers.StringRelatedField(source="operator", read_only=True)

    class Meta:
        model = Machine
        fields = "__all__"
        read_only_fields = ["operator_assigned_at", "operator_auto_remove_at"]


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = "__all__"
        extra_kwargs = {"updated_at": {"read_only": True}}


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"


class OrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.SerializerMethodField()
    created_by_username = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = "__all__"
        extra_kwargs = {
            "total": {"read_only": True},
            "order_date": {"read_only": True},
            "updated_at": {"read_only": True},
            "created_by": {"read_only": True},
        }

    def get_supplier_name(self, obj):
        return obj.supplier.name if obj.supplier else None

    def get_created_by_username(self, obj):
        return obj.created_by.username if obj.created_by else None


class OrderMaterialSerializer(serializers.ModelSerializer):
    material_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderMaterial
        fields = "__all__"
        extra_kwargs = {"total_price": {"read_only": True}}

    def get_material_name(self, obj):
        return obj.material.name if obj.material else None


class ProductionLineSerializer(serializers.ModelSerializer):
    worksop_name = serializers.StringRelatedField(source="workshop", read_only=True)
    machine_name = serializers.StringRelatedField(source="machine", read_only=True)

    class Meta:
        model = ProductionLine
        fields = "__all__"
        extra_kwargs = {"updated_at": {"read_only": True}}


class ManufacturingProcessSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManufacturingProcess
        fields = "__all__"
        extra_kwargs = {
            "updated_at": {"read_only": True},
            "created_at": {"read_only": True},
        }


class ProductionScheduleSerializer(serializers.ModelSerializer):
    production_line_name = serializers.StringRelatedField(
        source="production_line", read_only=True
    )
    product_name = serializers.StringRelatedField(source="product", read_only=True)

    class Meta:
        model = ProductionSchedule
        fields = "__all__"
        extra_kwargs = {
            "created_at": {"read_only": True},
            "updated_at": {"read_only": True},
            "created_by": {"read_only": True},
        }


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = "__all__"
        extra_kwargs = {"updated_at": {"read_only": True}}


class ProductProcessSerializer(serializers.ModelSerializer):
    product_name = serializers.StringRelatedField(source="product", read_only=True)
    process_name = serializers.StringRelatedField(source="process", read_only=True)

    class Meta:
        model = ProductProcess
        fields = "__all__"


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = "__all__"
        extra_kwargs = {"updated_at": {"read_only": True}}


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = "__all__"
        extra_kwargs = {"updated_at": {"read_only": True}}


class LaborAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = LaborAllocation
        fields = "__all__"
        extra_kwargs = {"updated_at": {"read_only": True}}


class SkillMatrixSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillMatrix
        fields = "__all__"
